import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorBadGateway,
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGatewayTimeout,
  IResponseErrorInternal,
  IResponseSuccessNoContent,
  ResponseErrorBadGateway,
  ResponseErrorConflict,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGatewayTimeout,
  ResponseErrorInternal,
  ResponseSuccessNoContent,
  getResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { SequenceMiddleware } from "@pagopa/ts-commons/lib/sequence_middleware";
import { defaultLog } from "@pagopa/winston-ts";
import * as express from "express";

import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";

import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { flow, pipe } from "fp-ts/lib/function";
import { ContainerClient } from "@azure/storage-blob";
import {
  ClientIp,
  ClientIpMiddleware
} from "@pagopa/io-functions-commons/dist/src/utils/middlewares/client_ip_middleware";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { LockSessionData } from "../generated/definitions/external/LockSessionData";
import { IConfig } from "../utils/config";
import { verifyUserEligibilityMiddleware } from "../utils/middlewares/user-eligibility-middleware";

import { Client } from "../generated/definitions/fast-login/client";
import { SpidLevel, gte } from "../utils/enums/SpidLevels";
import { TokenTypes } from "../utils/enums/TokenTypes";
import {
  ExchangeJwtPayloadExtended,
  exchangeJwtValidationMiddleware
} from "../utils/middlewares/exchange-jwt-validation-middleware";
import {
  HslJwtPayloadExtended,
  hslJwtValidationMiddleware
} from "../utils/middlewares/hsl-jwt-validation-middleware";
import { storeAuditLog } from "../utils/audit-log";
import { OperationTypes } from "../utils/enums/OperationTypes";

type LockSessionErrorResponsesT =
  | IResponseErrorConflict
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseErrorBadGateway
  | IResponseErrorGatewayTimeout;

type LockSessionHandlerT = (
  user: HslJwtPayloadExtended | ExchangeJwtPayloadExtended,
  payload: LockSessionData,
  maybeClientIp: ClientIp
) => Promise<IResponseSuccessNoContent | LockSessionErrorResponsesT>;

type LockSessionClient = Client<"ApiKeyAuth">;

const canLock = (
  user: HslJwtPayloadExtended | ExchangeJwtPayloadExtended
): boolean =>
  (ExchangeJwtPayloadExtended.is(user) &&
    user.token_type === TokenTypes.EXCHANGE) ||
  (HslJwtPayloadExtended.is(user) && gte(user.spid_level, SpidLevel.L2));

export const lockSessionHandler = (
  client: LockSessionClient,
  containerClient: ContainerClient
): LockSessionHandlerT => (
  reqJwtData,
  reqPayload,
  maybeClientIp: ClientIp
): ReturnType<LockSessionHandlerT> =>
  pipe(
    TE.Do,
    TE.bind("user_data", () => TE.of(reqJwtData)),
    TE.bind("unlock_code", () => TE.of(reqPayload.unlock_code)),
    TE.chain(
      flow(
        TE.fromPredicate(
          ({ user_data }) => canLock(user_data),
          ({ user_data }) =>
            getResponseErrorForbiddenNotAuthorized(
              `Could not perform lock-session. Required SpidLevel at least: {${
                SpidLevel.L2
              }}; User SpidLevel: {${
                HslJwtPayloadExtended.is(user_data)
                  ? user_data.spid_level
                  : undefined
              }}`
            )
        ),
        defaultLog.taskEither.errorLeft(
          errorResponse => `${errorResponse.detail}`
        )
      )
    ),
    TE.chainW(({ user_data, unlock_code }) =>
      TE.tryCatch(
        () =>
          client.lockUserSession({
            body: {
              fiscal_code: user_data.fiscal_number,
              unlock_code
            }
          }),
        flow(
          E.toError,
          e =>
            ResponseErrorInternal(
              `Something gone wrong calling fast-login: ${e.message}`
            ),
          defaultLog.peek.error(e => `${e.detail}`)
        )
      )
    ),
    TE.chainW(
      flow(
        TE.fromEither,
        TE.mapLeft(errors =>
          ResponseErrorInternal(readableReportSimplified(errors))
        ),
        defaultLog.taskEither.errorLeft(e => `${e.detail}`),
        TE.chainW(response => {
          switch (response.status) {
            case 204:
              return pipe(
                storeAuditLog(
                  containerClient,
                  {
                    ip: O.getOrElse(() => "UNKNOWN")(maybeClientIp),
                    jwtPayload: reqJwtData
                  },
                  {
                    DateTime: new Date(reqJwtData.iat * 1000).toISOString(),
                    FiscalCode: hashFiscalCode(reqJwtData.fiscal_number),
                    IDToken: reqJwtData.jti,
                    Ip: O.getOrElse(() => "UNKNOWN")(maybeClientIp),
                    Type: OperationTypes.LOCK
                  }
                ),
                TE.mapLeft(err =>
                  ResponseErrorInternal(
                    `Cannot store audit log | ERROR= ${err.message}`
                  )
                ),
                TE.map(_ => ResponseSuccessNoContent())
              );
            case 409:
              return TE.left<
                LockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(ResponseErrorConflict("Session was already locked"));
            case 502:
              return TE.left<
                LockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(ResponseErrorBadGateway(`Something gone wrong.`));
            case 504:
              return TE.left<
                LockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(
                ResponseErrorGatewayTimeout(
                  `Server couldn't respond in time, try again.`
                )
              );
            default:
              return TE.left<
                LockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(
                ResponseErrorInternal(
                  `Something gone wrong. Response Status: {${response.status}}`
                )
              );
          }
        })
      )
    ),
    TE.toUnion
  )();

export const getLockSessionHandler = (
  client: LockSessionClient,
  config: IConfig,
  containerClient: ContainerClient
): express.RequestHandler => {
  const handler = lockSessionHandler(client, containerClient);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    ClientIpMiddleware,
    verifyUserEligibilityMiddleware(config),
    SequenceMiddleware(ResponseErrorForbiddenNotAuthorized)(
      hslJwtValidationMiddleware(config),
      exchangeJwtValidationMiddleware(config)
    ),
    RequiredBodyPayloadMiddleware(LockSessionData)
  );

  return wrapRequestHandler(
    middlewaresWrap((_, clientIp, __, user, payload) =>
      handler(user, payload, clientIp)
    )
  );
};
