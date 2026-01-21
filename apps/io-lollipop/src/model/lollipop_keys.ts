import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";

import {
  CosmosdbModelVersionedTTL,
  RetrievedVersionedModelTTL
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned_ttl";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Container, RequestOptions } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

import { AssertionRef } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionRef";
import { AssertionType } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { Timestamp } from "@pagopa/io-functions-commons/dist/generated/definitions/Timestamp";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { pipe } from "fp-ts/lib/function";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";

export const LOLLIPOPKEYS_COLLECTION_NAME = "lollipop-pubkeys";
export const LOLLIPOPKEYS_MODEL_PK_FIELD = "assertionRef" as const;

export const Ttl = t.interface({
  ttl: NonNegativeInteger // do we need this to be -1 in some cases?
});
export type Ttl = t.TypeOf<typeof Ttl>;

// The time for which we want to reserve a key during login process (in seconds)
export const TTL_VALUE_FOR_RESERVATION = 900 as NonNegativeInteger; // 15m
// The time for which we want to keep the lolliPopPubKeys
export const TTL_VALUE_AFTER_UPDATE = 63072000 as NonNegativeInteger; // 2y

export const PendingLolliPopPubKeys = t.interface({
  assertionRef: AssertionRef,
  pubKey: NonEmptyString,
  status: t.literal(PubKeyStatusEnum.PENDING)
});
export type PendingLolliPopPubKeys = t.TypeOf<typeof PendingLolliPopPubKeys>;

export const BaseNotPendingLolliPopPubKeys = t.interface({
  assertionFileName: AssertionFileName,
  assertionRef: AssertionRef,
  assertionType: AssertionType,
  expiredAt: Timestamp,
  fiscalCode: FiscalCode,
  pubKey: NonEmptyString
});

export const ValidLolliPopPubKeys = t.intersection([
  BaseNotPendingLolliPopPubKeys,
  t.interface({ status: t.literal(PubKeyStatusEnum.VALID) })
]);
export type ValidLolliPopPubKeys = t.TypeOf<typeof ValidLolliPopPubKeys>;

export const RevokedLolliPopPubKeys = t.intersection([
  BaseNotPendingLolliPopPubKeys,
  t.interface({ status: t.literal(PubKeyStatusEnum.REVOKED) })
]);
export type RevokedLolliPopPubKeys = t.TypeOf<typeof RevokedLolliPopPubKeys>;

export const NotPendingLolliPopPubKeys = t.union([
  ValidLolliPopPubKeys,
  RevokedLolliPopPubKeys
]);
export type NotPendingLolliPopPubKeys = t.TypeOf<
  typeof NotPendingLolliPopPubKeys
>;

// T type
export const LolliPopPubKeys = t.union([
  ValidLolliPopPubKeys,
  RevokedLolliPopPubKeys,
  PendingLolliPopPubKeys
]);
export type LolliPopPubKeys = t.TypeOf<typeof LolliPopPubKeys>;

// TN type
export const NewLolliPopPubKeys = t.intersection([
  LolliPopPubKeys,
  t.partial({
    ttl: NonNegativeInteger
  })
]);
export type NewLolliPopPubKeys = t.TypeOf<typeof NewLolliPopPubKeys>;

// TR type
export const RetrievedLolliPopPubKeys = t.intersection([
  LolliPopPubKeys,
  Ttl,
  RetrievedVersionedModelTTL
]);
export type RetrievedLolliPopPubKeys = t.TypeOf<
  typeof RetrievedLolliPopPubKeys
>;

export class LolliPOPKeysModel extends CosmosdbModelVersionedTTL<
  LolliPopPubKeys,
  NewLolliPopPubKeys,
  RetrievedLolliPopPubKeys,
  // the actual version of the versionedModel does not support the typings for the modelId field
  typeof LOLLIPOPKEYS_MODEL_PK_FIELD
> {
  constructor(container: Container) {
    super(
      container,
      NewLolliPopPubKeys,
      RetrievedLolliPopPubKeys,
      LOLLIPOPKEYS_MODEL_PK_FIELD
    );
  }

  /*
   * Reserve the key by creating a new document with version 0 with the ttl setted for the time needed,
   * */
  public create(
    lolliPopPubKeys: LolliPopPubKeys,
    option?: RequestOptions
  ): TE.TaskEither<CosmosErrors, RetrievedLolliPopPubKeys> {
    return pipe(
      super.findLastVersionByModelId([lolliPopPubKeys.assertionRef]),
      TE.chain(maybeDocument =>
        pipe(
          maybeDocument,
          O.fold(
            () =>
              pipe(
                O.none,
                this.getTtlValue(lolliPopPubKeys), // super.create never returns 409 error but a generic CosmosErrorResponse with io-functions-commons v26.8.1
                ttl => super.create({ ...lolliPopPubKeys, ttl }, option)
              ),
            _ =>
              TE.left({
                kind: "COSMOS_CONFLICT_RESPONSE"
              })
          )
        )
      )
    );
  }

  /*
   * Update the last version of the document setting the new properties and the ttl at 2 years
   * */
  public upsert(
    lolliPopPubKeys: LolliPopPubKeys,
    option?: RequestOptions
  ): TE.TaskEither<CosmosErrors, RetrievedLolliPopPubKeys> {
    return pipe(
      super.findLastVersionByModelId([lolliPopPubKeys.assertionRef]),
      TE.map(this.getTtlValue(lolliPopPubKeys)),
      TE.chain(ttl => super.upsert({ ...lolliPopPubKeys, ttl }, option))
    );
  }

  /**
   * This method is disabled to avoid wrong use cases. Use upsert instead.
   *
   * @deprecated
   * */
  public update(
    _: RetrievedLolliPopPubKeys
  ): TE.TaskEither<CosmosErrors, never> {
    return TE.left(
      toCosmosErrorResponse(
        new Error("Updating lollipop public keys is forbidden")
      )
    );
  }

  /**
   * This method is disabled to avoid wrong use cases.
   *
   * @deprecated Use updateKeys instead.
   * */
  public updateTTLForAllVersions(): TE.TaskEither<CosmosErrors, never> {
    return TE.left(
      toCosmosErrorResponse(
        new Error("Update tll for old versions is forbidden")
      )
    );
  }

  private getTtlValue(
    lolliPopPubKeys: LolliPopPubKeys
  ): (lastVersion: O.Option<RetrievedLolliPopPubKeys>) => NonNegativeInteger {
    return (lastVersion): NonNegativeInteger =>
      pipe(
        lastVersion,
        // if the last version was PENDING the new ttl is setted to TTL_VALUE_AFTER_UPDATE
        // if the last version ttl is missing then the new ttl is setted to TTL_VALUE_AFTER_UPDATE to avoid setting the ttl to a negative value
        O.map(lastPop =>
          lastPop.status === PubKeyStatusEnum.PENDING || (lastPop.ttl ?? 0) < 1
            ? TTL_VALUE_AFTER_UPDATE
            : // eslint-disable-next-line @typescript-eslint/restrict-plus-operands, no-underscore-dangle
              ((lastPop._ts +
                (lastPop.ttl ?? 0) -
                Math.floor(new Date().getTime() / 1000)) as NonNegativeInteger)
        ),
        O.getOrElseW(() =>
          lolliPopPubKeys.status === PubKeyStatusEnum.PENDING
            ? TTL_VALUE_FOR_RESERVATION
            : TTL_VALUE_AFTER_UPDATE
        )
      );
  }
}
