import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import {
  IResponseErrorBadGateway,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGatewayTimeout,
  IResponseErrorInternal,
  IResponseSuccessNoContent,
  ResponseErrorBadGateway,
  ResponseErrorGatewayTimeout,
  ResponseErrorInternal,
  ResponseSuccessNoContent,
  getResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";

import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";

import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { defaultLog } from "@pagopa/winston-ts";
import { flow, pipe } from "fp-ts/lib/function";
import {
  ClientIp,
  ClientIpMiddleware
} from "@pagopa/io-functions-commons/dist/src/utils/middlewares/client_ip_middleware";
import { ContainerClient } from "@azure/storage-blob";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { UnlockSessionData } from "../generated/definitions/external/UnlockSessionData";
import { IConfig } from "../utils/config";
import { verifyUserEligibilityMiddleware } from "../utils/middlewares/user-eligibility-middleware";

import { UnlockCode } from "../generated/definitions/external/UnlockCode";
import { Client } from "../generated/definitions/fast-login/client";
import { SpidLevel } from "../utils/enums/SpidLevels";
import {
  HslJwtPayloadExtended,
  hslJwtValidationMiddleware
} from "../utils/middlewares/hsl-jwt-validation-middleware";
import { storeAuditLog } from "../utils/audit-log";
import { OperationTypes } from "../utils/enums/OperationTypes";

type UnlockSessionErrorResponsesT =
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseErrorBadGateway
  | IResponseErrorGatewayTimeout;

type UnlockSessionHandlerT = (
  user: HslJwtPayloadExtended,
  payload: UnlockSessionData,
  maybeClientIp: ClientIp
) => Promise<IResponseSuccessNoContent | UnlockSessionErrorResponsesT>;

type UnlockSessionClient = Client<"ApiKeyAuth">;

const canUnlock = (
  user: HslJwtPayloadExtended,
  unlock_code: O.Option<UnlockCode>
): boolean =>
  HslJwtPayloadExtended.is(user) &&
  (user.spid_level === SpidLevel.L3 ||
    (user.spid_level === SpidLevel.L2 && O.isSome(unlock_code)));

export const unlockSessionHandler = (
  client: UnlockSessionClient,
  containerClient: ContainerClient
): UnlockSessionHandlerT => (
  reqJwtData,
  reqPayload,
  maybeClientIp
): ReturnType<UnlockSessionHandlerT> =>
  pipe(
    TE.Do,
    TE.bind("user_data", () => TE.of(reqJwtData)),
    TE.bind("unlock_code", () => TE.of(O.fromNullable(reqPayload.unlock_code))),
    TE.chain(
      flow(
        TE.fromPredicate(
          ({ user_data, unlock_code }) => canUnlock(user_data, unlock_code),
          ({ user_data, unlock_code }) =>
            getResponseErrorForbiddenNotAuthorized(
              `Could not perform unlock-session. SpidLevel: {${
                user_data.spid_level
              }}, UnlockCode: {${O.toUndefined(unlock_code)}}`
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
          client.unlockUserSession({
            body: {
              fiscal_code: user_data.fiscal_number,
              unlock_code: O.toUndefined(unlock_code)
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
                    Type: OperationTypes.UNLOCK
                  }
                ),
                TE.mapLeft(err =>
                  ResponseErrorInternal(
                    `Cannot store audit log | ERROR= ${err.message}`
                  )
                ),
                TE.map(_ => ResponseSuccessNoContent())
              );
            case 403:
              return TE.left<
                UnlockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(getResponseErrorForbiddenNotAuthorized(`Forbidden`));
            case 502:
              return TE.left<
                UnlockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(ResponseErrorBadGateway(`Something gone wrong.`));
            case 504:
              return TE.left<
                UnlockSessionErrorResponsesT,
                IResponseSuccessNoContent
              >(
                ResponseErrorGatewayTimeout(
                  `Server couldn't respond in time, try again.`
                )
              );

            default:
              return TE.left<
                UnlockSessionErrorResponsesT,
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

export const getUnlockSessionHandler = (
  client: UnlockSessionClient,
  config: IConfig,
  containerClient: ContainerClient
): express.RequestHandler => {
  const handler = unlockSessionHandler(client, containerClient);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    ClientIpMiddleware,
    verifyUserEligibilityMiddleware(config),
    hslJwtValidationMiddleware(config),
    RequiredBodyPayloadMiddleware(UnlockSessionData)
  );

  return wrapRequestHandler(
    middlewaresWrap((_, clientIp, __, user, payload) =>
      handler(user, payload, clientIp)
    )
  );
};
