import { InvocationContext } from "@azure/functions";

import { Logger } from "../utils/logging";

import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";

import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";

import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as dateUtils from "date-fns";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LcParams } from "../generated/definitions/internal/LcParams";
import { GenerateLcParamsPayload } from "../generated/definitions/internal/GenerateLcParamsPayload";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

import { getGenerateAuthJWT } from "../utils/auth_jwt";
import {
  isValidLollipopPubKey,
  retrievedLollipopKeysToApiLcParams,
} from "../utils/lollipopKeys";
import { PublicKeyDocumentReader } from "../utils/readers";
import { domainErrorToResponseError, ErrorKind } from "../utils/errors";

const FN_LOG_NAME = "generate-lc-params";

/**
 * Type of a GenerateLCParams handler
 */

type IGenerateLCParamsHandler = (
  context: InvocationContext,
  assertionRef: AssertionRef,
  payload: GenerateLcParamsPayload,
) => Promise<
  | IResponseSuccessJson<LcParams>
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorNotFound
  | IResponseErrorInternal
>;
/**
 * Handles requests for generating Lollipop Consumer required params.
 */
export const GenerateLCParamsHandler =
  (
    publicKeyDocumentReader: PublicKeyDocumentReader,
    expireGracePeriodInDays: NonNegativeInteger,
    authJwtGenerator: ReturnType<typeof getGenerateAuthJWT>,
    defaultLogger: Logger,
    eventLogger: Logger,
  ): IGenerateLCParamsHandler =>
  async (
    context,
    assertionRef,
    payload,
  ): ReturnType<IGenerateLCParamsHandler> =>
    pipe(
      publicKeyDocumentReader(assertionRef),
      defaultLogger.taskEither.errorLeft(
        (domainError) =>
          `Error retrieving assertionRef ${assertionRef} from Cosmos: ${
            domainError.kind
          }${
            domainError.kind === ErrorKind.Internal
              ? ` [${domainError.detail}]`
              : ""
          }`,
      ),
      TE.mapLeft(domainErrorToResponseError),
      TE.filterOrElseW(isValidLollipopPubKey, (doc) =>
        pipe(
          ResponseErrorForbiddenNotAuthorized,
          eventLogger.peek.error([
            `Unexpected status on pop document: expected ${PubKeyStatusEnum.VALID}, found ${doc.status}`,
            {
              assertion_ref: assertionRef,
              name: FN_LOG_NAME,
              operation_id: payload.operation_id,
            },
          ]),
        ),
      ),
      TE.filterOrElseW(
        (usedPubKeyDocument) =>
          usedPubKeyDocument.expiredAt.getTime() >
          dateUtils.addDays(new Date(), -expireGracePeriodInDays).getTime(),
        (doc) =>
          pipe(
            ResponseErrorForbiddenNotAuthorized,
            eventLogger.peek.error([
              `Pop document expired at ${doc.expiredAt} with grace period of ${expireGracePeriodInDays} days`,
              {
                assertion_ref: assertionRef,
                name: FN_LOG_NAME,
                operation_id: payload.operation_id,
              },
            ]),
          ),
      ),
      TE.bindTo("activePubKey"),
      TE.bindW("lcAuthJwt", () =>
        pipe(
          authJwtGenerator({
            assertionRef,
            operationId: payload.operation_id,
          }),
          TE.mapLeft((e) =>
            ResponseErrorInternal(
              `Cannot generate LC Auth JWT|ERROR=${e.message}`,
            ),
          ),
          defaultLogger.taskEither.errorLeft(
            (r) => r.detail ?? "Cannot generate LC Auth JWT",
          ),
        ),
      ),
      TE.map(({ activePubKey, lcAuthJwt }) =>
        ResponseSuccessJson(
          retrievedLollipopKeysToApiLcParams(activePubKey, lcAuthJwt),
        ),
      ),
      eventLogger.taskEither.info(() => [
        `LC Params successfully generated for assertionRef ${assertionRef} and operationId ${payload.operation_id}`,
        {
          assertion_ref: assertionRef,
          name: FN_LOG_NAME,
          operation_id: payload.operation_id,
        },
      ]),
      TE.toUnion,
    )();

/**
 * Wraps a GenerateLCParamsHandler handler inside an Express request handler.
 */
export function GenerateLCParams(
  publicKeyDocumentReader: PublicKeyDocumentReader,
  expireGracePeriodInDays: NonNegativeInteger,
  authJwtGenerator: ReturnType<typeof getGenerateAuthJWT>,
  defaultLogger: Logger,
  eventLogger: Logger,
) {
  const handler = GenerateLCParamsHandler(
    publicKeyDocumentReader,
    expireGracePeriodInDays,
    authJwtGenerator,
    defaultLogger,
    eventLogger,
  );
  const middlewares = [
    ContextMiddleware(),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    RequiredBodyPayloadMiddleware(GenerateLcParamsPayload),
  ] as const;
  return wrapHandlerV4(middlewares, handler);
}
