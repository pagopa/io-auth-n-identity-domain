import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { IRequestMiddleware } from "@pagopa/ts-commons/lib/request_middleware";
import {
  getResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { flow, pipe } from "fp-ts/lib/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as jwt from "jsonwebtoken";
import { AuthBearer } from "../generated/definitions/external/AuthBearer";
import { IConfig } from "./config";

export const BaseJwtPayload = t.type({
  family_name: NonEmptyString,
  fiscal_number: FiscalCode,
  iat: t.number,
  jti: NonEmptyString,
  name: NonEmptyString
});
export type BaseJwtPayload = t.TypeOf<typeof BaseJwtPayload>;

export const jwtValidationMiddleware = <T>(
  config: IConfig,
  validation: (
    token: NonEmptyString
  ) => TE.TaskEither<IResponseErrorForbiddenNotAuthorized, jwt.JwtPayload>,
  codec: t.Type<T>
): IRequestMiddleware<"IResponseErrorForbiddenNotAuthorized", T> => (
  req
): Promise<E.Either<IResponseErrorForbiddenNotAuthorized, T>> =>
  pipe(
    req.headers[config.BEARER_AUTH_HEADER],
    AuthBearer.decode,
    E.mapLeft(_ =>
      getResponseErrorForbiddenNotAuthorized(
        `Invalid or missing JWT in header ${config.BEARER_AUTH_HEADER}`
      )
    ),
    E.map(authBearer => authBearer.replace("Bearer ", "") as NonEmptyString),
    TE.fromEither,
    TE.chain(validation),
    TE.chain(
      flow(
        codec.decode,
        E.mapLeft(errors =>
          getResponseErrorForbiddenNotAuthorized(
            `Invalid JWT payload: ${readableReportSimplified(errors)}`
          )
        ),
        TE.fromEither
      )
    )
  )();
