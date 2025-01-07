import * as express from "express";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import * as jsonwebtoken from "jsonwebtoken";
import {
  ClientIp,
  ClientIpMiddleware
} from "@pagopa/io-functions-commons/dist/src/utils/middlewares/client_ip_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { defaultLog } from "@pagopa/winston-ts";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Context } from "@azure/functions";
import { ContainerClient } from "@azure/storage-blob";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { IConfig } from "../utils/config";

import { ExchangeToken } from "../generated/definitions/external/ExchangeToken";
import { TokenTypes } from "../utils/enums/TokenTypes";
import {
  MagicLinkPayload,
  getGenerateExchangeJWT
} from "../utils/exchange-jwt";
import { magicLinkJweValidationMiddleware } from "../utils/middlewares/magic-link-jwe-validation-middleware";
import { storeAuditLog } from "../utils/audit-log";
import { BaseJwtPayload } from "../utils/jwt";
import { OperationTypes } from "../utils/enums/OperationTypes";

export const decodeToken = (
  token: NonEmptyString
): TE.TaskEither<Error, BaseJwtPayload> =>
  pipe(
    jsonwebtoken.decode(token),
    BaseJwtPayload.decode,
    TE.fromEither,
    TE.mapLeft(() => new Error("Unable to decode JWT"))
  );

type ExchangeHandlerT = (
  user: MagicLinkPayload,
  context: Context,
  maybeClientIp: ClientIp
) => Promise<IResponseErrorInternal | IResponseSuccessJson<ExchangeToken>>;

export const exchangeHandler = (
  config: IConfig,
  containerClient: ContainerClient
): ExchangeHandlerT => (
  user_data,
  _context,
  maybeClientIp
): ReturnType<ExchangeHandlerT> =>
  pipe(
    getGenerateExchangeJWT(config)({
      family_name: user_data.family_name,
      fiscal_number: user_data.fiscal_number,
      name: user_data.name,
      token_type: TokenTypes.EXCHANGE
    }),
    TE.mapLeft(e =>
      ResponseErrorInternal(`Cannot generate Exchange JWT|ERROR=${e.message}`)
    ),
    defaultLog.taskEither.errorLeft(
      r => r.detail ?? "Cannot generate Exchange JWT"
    ),
    TE.chain(jwt =>
      pipe(
        decodeToken(jwt),
        TE.chain(decodedToken =>
          storeAuditLog(
            containerClient,
            {
              fatherTokenId: user_data.jti,
              ip: O.getOrElse(() => "UNKNOWN")(maybeClientIp),
              tokenIssuingTime: new Date(user_data.iat * 1000).toISOString()
            },
            {
              DateTime: new Date(decodedToken.iat * 1000).toISOString(),
              FatherIDToken: user_data.jti,
              FiscalCode: hashFiscalCode(decodedToken.fiscal_number),
              IDToken: decodedToken.jti,
              Ip: O.getOrElse(() => "UNKNOWN")(maybeClientIp),
              Type: OperationTypes.EXCHANGE
            }
          )
        ),
        TE.mapLeft(err =>
          ResponseErrorInternal(
            `Cannot store audit log | ERROR= ${err.message}`
          )
        ),
        TE.map(_ => jwt)
      )
    ),
    TE.map(jwt => ResponseSuccessJson({ jwt } as ExchangeToken)),
    TE.toUnion
  )();

export const getExchangeHandler = (
  config: IConfig,
  containerClient: ContainerClient
): express.RequestHandler => {
  const handler = exchangeHandler(config, containerClient);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    // extracts the client IP from the request
    ClientIpMiddleware,
    magicLinkJweValidationMiddleware(
      config.BEARER_AUTH_HEADER,
      config.MAGIC_LINK_JWE_ISSUER,
      config.BLACKLISTED_JTI_LIST,
      config.MAGIC_LINK_JWE_PRIMARY_PRIVATE_KEY,
      config.MAGIC_LINK_JWE_SECONDARY_PRIVATE_KEY
    )
  );

  return wrapRequestHandler(
    middlewaresWrap((context, clientIp, user) =>
      handler(user, context, clientIp)
    )
  );
};
