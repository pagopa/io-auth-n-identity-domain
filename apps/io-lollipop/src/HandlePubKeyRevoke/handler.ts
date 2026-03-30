/* eslint-disable no-console */
/* eslint-disable max-params */
import { InvocationContext } from "@azure/functions";
import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { JwkPublicKeyFromToken } from "@pagopa/ts-commons/lib/jwk";
import { TelemetryClient, trackException } from "../utils/appinsights";
import { errorsToError } from "../utils/conversions";
import {
  Failure,
  PermanentFailure,
  toPermanentFailure,
  toTransientFailure,
  TransientFailure,
} from "../utils/errors";
import {
  LolliPOPKeysModel,
  NotPendingLolliPopPubKeys,
  RetrievedLolliPopPubKeys,
} from "../model/lollipop_keys";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";
import { JwkPubKeyHashAlgorithm } from "../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import {
  getAlgoFromAssertionRef,
  getAllAssertionsRef,
} from "../utils/lollipopKeys";

/**
 * Based on a previous retrieved LollipopPubKey that match with assertionRef retrieved on queue
 * this function extracts all lollipopPubKeys to be revoked including master key
 *
 * @param lollipopKeysModel
 * @returns an array containing master and optionally used lollipopPubKeys to be revoked
 *
 */
const extractPubKeysToRevoke =
  (lollipopKeysModel: LolliPOPKeysModel, masterAlgo: JwkPubKeyHashAlgorithm) =>
  (
    notPendingLollipopPubKeys: NotPendingLolliPopPubKeys,
  ): TE.TaskEither<Failure, ReadonlyArray<NotPendingLolliPopPubKeys>> =>
    pipe(
      notPendingLollipopPubKeys.pubKey,
      JwkPublicKeyFromToken.decode,
      TE.fromEither,
      TE.mapLeft(() => toPermanentFailure(Error("Cannot decode used jwk"))()),
      TE.chain((decodedJwk) =>
        pipe(
          getAllAssertionsRef(
            masterAlgo,
            getAlgoFromAssertionRef(notPendingLollipopPubKeys.assertionRef),
            decodedJwk,
          ),
          TE.mapLeft((e) => toPermanentFailure(e)()),
        ),
      ),
      TE.chain(({ master, used }) =>
        pipe(
          used,
          O.fromNullable,
          O.fold(
            () => TE.of([notPendingLollipopPubKeys]),
            (_) =>
              pipe(
                lollipopKeysModel.findLastVersionByModelId([master]),
                TE.mapLeft(() =>
                  toTransientFailure(
                    Error("Cannot perform find masterKey on CosmosDB"),
                  )(),
                ),
                TE.chain(
                  TE.fromOption(() =>
                    toTransientFailure(
                      Error("Cannot find a master lollipopPubKey"),
                    )(),
                  ),
                ),
                TE.chainEitherK(
                  flow(
                    NotPendingLolliPopPubKeys.decode,
                    E.mapLeft(() =>
                      toTransientFailure(
                        Error("Cannot decode a VALID master lollipopPubKey"),
                      )(),
                    ),
                  ),
                ),
                TE.map((validMasterLollipopPubKeys) => [
                  validMasterLollipopPubKeys,
                  notPendingLollipopPubKeys,
                ]),
              ),
          ),
        ),
      ),
    );

// Migrated from function.json exponentialBackoff retry to host.json extensions.queues.
// With binding-level retry, retryContext is not populated; use triggerMetadata.dequeueCount.
const isLastRetry = (
  context: InvocationContext,
  maxDequeueCount: number,
): boolean => {
  // context.triggerMetadata?.dequeueCount is 1-based
  const dequeueCount = (context.triggerMetadata?.dequeueCount as number) ?? 1;
  return dequeueCount >= maxDequeueCount;
};

const revokePubKey =
  (lollipopKeysModel: LolliPOPKeysModel) =>
  (
    notPendingLollipopPubKey: NotPendingLolliPopPubKeys,
  ): TE.TaskEither<CosmosErrors, RetrievedLolliPopPubKeys> =>
    lollipopKeysModel.upsert({
      ...notPendingLollipopPubKey,
      status: PubKeyStatusEnum.REVOKED,
    });

export const handleRevoke = (
  context: InvocationContext,
  telemetryClient: TelemetryClient,
  lollipopKeysModel: LolliPOPKeysModel,
  masterAlgo: JwkPubKeyHashAlgorithm,
  maxDequeueCount: number,
  rawRevokeMessage: unknown,
): Promise<Failure | void> =>
  pipe(
    rawRevokeMessage,
    RevokeAssertionRefInfo.decode,
    TE.fromEither,
    TE.mapLeft(flow(errorsToError, (e) => toPermanentFailure(e)())),
    TE.chain((revokeAssertionRefInfo) =>
      pipe(
        lollipopKeysModel.findLastVersionByModelId([
          revokeAssertionRefInfo.assertion_ref,
        ]),
        TE.mapLeft((err) =>
          toTransientFailure(
            Error(`Cannot perform find on CosmosDB: ${JSON.stringify(err)}`),
          )(),
        ),
        TE.map(O.chainEitherK(NotPendingLolliPopPubKeys.decode)),
        TE.chain(
          O.foldW(
            () => TE.right(void 0),
            flow(
              extractPubKeysToRevoke(lollipopKeysModel, masterAlgo),
              TE.chainW(
                flow(
                  RA.map(revokePubKey(lollipopKeysModel)),
                  RA.sequence(TE.ApplicativePar),
                  TE.mapLeft((err) =>
                    toTransientFailure(
                      Error(
                        `Cannot perform upsert CosmosDB: ${JSON.stringify(err)}`,
                      ),
                    )(),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    TE.mapLeft((err) => {
      const isTransient = TransientFailure.is(err);
      const error = isTransient
        ? `HandlePubKeyRevoke|TRANSIENT_ERROR=${err.reason}`
        : `HandlePubKeyRevoke|FATAL|PERMANENT_ERROR=${
            err.reason
          }|INPUT=${JSON.stringify(rawRevokeMessage)}`;
      trackException(telemetryClient, {
        exception: new Error(error),
        properties: {
          assertionRef: pipe(
            rawRevokeMessage,
            RevokeAssertionRefInfo.decode,
            E.map((message) => message.assertion_ref),
            E.getOrElse(() => "unknown"),
          ),
          detail: err.kind,
          errorMessage: error,
          fatal: PermanentFailure.is(err).toString(),
          isSuccess: "false",
          maxRetryCount: String(maxDequeueCount),
          modelId: err.modelId ?? "",
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: String(
            (context.triggerMetadata?.dequeueCount as number) ?? "undefined",
          ),
        },
        tagOverrides: {
          samplingEnabled:
            !isTransient || isLastRetry(context, maxDequeueCount)
              ? "false"
              : "true",
        },
      });
      context.error(error);
      if (isTransient) {
        // Trigger a retry in case of temporary failures
        throw new Error(error);
      }
      return err;
    }),
    TE.map(constVoid),
    TE.toUnion,
  )();
