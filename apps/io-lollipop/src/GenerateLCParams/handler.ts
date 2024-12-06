import express from "express";
import { Context } from "@azure/functions";

import { defaultLog, eventLog } from "@pagopa/winston-ts";

import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson
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
  retrievedLollipopKeysToApiLcParams
} from "../utils/lollipopKeys";
import { PublicKeyDocumentReader } from "../utils/readers";
import { domainErrorToResponseError, ErrorKind } from "../utils/errors";

const FN_LOG_NAME = "generate-lc-params";

/**
 * Type of a GenerateLCParams handler
 */

type IGenerateLCParamsHandler = (
  context: Context,
  assertionRef: AssertionRef,
  payload: GenerateLcParamsPayload
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
export const GenerateLCParamsHandler = (
  publicKeyDocumentReader: PublicKeyDocumentReader,
  expireGracePeriodInDays: NonNegativeInteger,
  authJwtGenerator: ReturnType<typeof getGenerateAuthJWT>
): IGenerateLCParamsHandler => async (
  context,
  assertionRef,
  payload
): ReturnType<IGenerateLCParamsHandler> =>
  pipe(
    publicKeyDocumentReader(assertionRef),
    defaultLog.taskEither.errorLeft(
      domainError =>
        `Error retrieving assertionRef ${assertionRef} from Cosmos: ${
          domainError.kind
        }${
          domainError.kind === ErrorKind.Internal
            ? ` [${domainError.detail}]`
            : ""
        }`
    ),
    TE.mapLeft(domainErrorToResponseError),
    TE.filterOrElseW(isValidLollipopPubKey, doc =>
      pipe(
        ResponseErrorForbiddenNotAuthorized,
        eventLog.peek.error([
          `Unexpected status on pop document: expected ${PubKeyStatusEnum.VALID}, found ${doc.status}`,
          {
            assertion_ref: assertionRef,
            name: FN_LOG_NAME,
            operation_id: payload.operation_id
          }
        ])
      )
    ),
    TE.filterOrElseW(
      usedPubKeyDocument =>
        usedPubKeyDocument.expiredAt.getTime() >
        dateUtils.addDays(new Date(), -expireGracePeriodInDays).getTime(),
      doc =>
        pipe(
          ResponseErrorForbiddenNotAuthorized,
          eventLog.peek.error([
            `Pop document expired at ${doc.expiredAt} with grace period of ${expireGracePeriodInDays} days`,
            {
              assertion_ref: assertionRef,
              name: FN_LOG_NAME,
              operation_id: payload.operation_id
            }
          ])
        )
    ),
    TE.bindTo("activePubKey"),
    TE.bindW("lcAuthJwt", () =>
      pipe(
        authJwtGenerator({
          assertionRef,
          operationId: payload.operation_id
        }),
        TE.mapLeft(e =>
          ResponseErrorInternal(
            `Cannot generate LC Auth JWT|ERROR=${e.message}`
          )
        ),
        defaultLog.taskEither.errorLeft(
          r => r.detail ?? "Cannot generate LC Auth JWT"
        )
      )
    ),
    TE.map(({ activePubKey, lcAuthJwt }) =>
      ResponseSuccessJson(
        retrievedLollipopKeysToApiLcParams(activePubKey, lcAuthJwt)
      )
    ),
    eventLog.taskEither.info(() => [
      `LC Params successfully generated for assertionRef ${assertionRef} and operationId ${payload.operation_id}`,
      {
        assertion_ref: assertionRef,
        name: FN_LOG_NAME,
        operation_id: payload.operation_id
      }
    ]),
    TE.toUnion
  )();

/**
 * Wraps a GenerateLCParamsHandler handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GenerateLCParams(
  publicKeyDocumentReader: PublicKeyDocumentReader,
  expireGracePeriodInDays: NonNegativeInteger,
  authJwtGenerator: ReturnType<typeof getGenerateAuthJWT>
): express.RequestHandler {
  const handler = GenerateLCParamsHandler(
    publicKeyDocumentReader,
    expireGracePeriodInDays,
    authJwtGenerator
  );
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    RequiredBodyPayloadMiddleware(GenerateLcParamsPayload)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
