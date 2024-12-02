import * as express from "express";
import { withRequestMiddlewares } from "@pagopa/ts-commons/lib/request_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseSuccessRedirectToResource,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseSuccessRedirectToResource
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import * as A from "fp-ts/Apply";
import * as R from "fp-ts/Record";
import { isDefined } from "@pagopa/io-functions-commons/dist/src/utils/types";
import { eventLog } from "@pagopa/winston-ts";
import { encodeBase64 } from "../utils/thumbprint";
import { MASTER_HASH_ALGO } from "../utils/lollipopKeys";
import { NewPubKey } from "../generated/definitions/internal/NewPubKey";
import { NewPubKeyPayload } from "../generated/definitions/internal/NewPubKeyPayload";
import {
  LolliPOPKeysModel,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";
import { getAllAssertionsRef } from "../utils/lollipopKeys";
import { AssertionRef } from "../generated/definitions/external/AssertionRef";
import { JwkPubKey } from "../generated/definitions/internal/JwkPubKey";

const FN_LOG_NAME = "reserve-pubkey";

type IReservePubKeyHandler = (
  inputPubkeys: NewPubKeyPayload
) => Promise<
  | IResponseSuccessRedirectToResource<NewPubKey, NewPubKey>
  | IResponseErrorConflict
  | IResponseErrorInternal
>;

const cosmosErrorsToResponse = (
  error: CosmosErrors
): IResponseErrorConflict | IResponseErrorInternal =>
  error.kind === "COSMOS_CONFLICT_RESPONSE"
    ? ResponseErrorConflict("A lollipop pubKey has been already reserved")
    : ResponseErrorInternal(JSON.stringify(error));

export const reserveSingleKey = (
  lollipopPubkeysModel: LolliPOPKeysModel,
  pubKey: JwkPubKey
) => (
  assertionRef: AssertionRef
): TE.TaskEither<
  IResponseErrorInternal | IResponseErrorConflict,
  RetrievedLolliPopPubKeys
> =>
  pipe(
    {
      assertionRef,
      pubKey: encodeBase64(pubKey) as NonEmptyString,
      status: PubKeyStatusEnum.PENDING as const
    },
    pendingPubKey =>
      pipe(
        lollipopPubkeysModel.create(pendingPubKey),
        TE.mapLeft(cosmosErrorsToResponse)
      )
  );

export const reservePubKeys = (
  lollipopPubkeysModel: LolliPOPKeysModel
): IReservePubKeyHandler => (inputPubkeys): ReturnType<IReservePubKeyHandler> =>
  pipe(
    getAllAssertionsRef(
      MASTER_HASH_ALGO,
      inputPubkeys.algo,
      inputPubkeys.pub_key
    ),
    eventLog.taskEither.errorLeft(error => [
      `${error.name} - ${error.message}`,
      {
        name: FN_LOG_NAME
      }
    ]),
    TE.mapLeft(err => ResponseErrorInternal(err.message)),
    TE.chain(assertions =>
      pipe(
        assertions,
        R.filter(isDefined),
        R.map(reserveSingleKey(lollipopPubkeysModel, inputPubkeys.pub_key)),
        A.sequenceS(TE.ApplicativePar),
        eventLog.taskEither.errorLeft(error => [
          `Error reserving keys: ${error.detail}`,
          {
            masterKey: assertions.master,
            name: FN_LOG_NAME,
            usedKey: assertions.used ?? assertions.master
          }
        ])
      )
    ),
    TE.map(reservedKeys =>
      reservedKeys.used !== undefined ? reservedKeys.used : reservedKeys.master
    ),
    TE.map(reservedKey => ({
      assertion_ref: reservedKey.assertionRef,
      pub_key: reservedKey.pubKey,
      status: reservedKey.status,
      ttl: (reservedKey.ttl ?? 0) as NonNegativeInteger,
      version: reservedKey.version
    })),
    TE.map(newPubKey =>
      ResponseSuccessRedirectToResource(
        newPubKey,
        `/pubKeys/${newPubKey.assertion_ref}`,
        newPubKey
      )
    ),
    TE.toUnion
  )();

export const getReservePubKeyHandler = (
  lollipopPubkeysModel: LolliPOPKeysModel
): express.RequestHandler => {
  const handler = reservePubKeys(lollipopPubkeysModel);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredBodyPayloadMiddleware(NewPubKeyPayload)
  );
  return wrapRequestHandler(
    middlewaresWrap((_, inputPubkeys) => handler(inputPubkeys))
  );
};
