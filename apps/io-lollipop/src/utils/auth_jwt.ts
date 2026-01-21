import * as t from "io-ts";

import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { Second } from "@pagopa/ts-commons/lib/units";
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  getResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { eventLog } from "@pagopa/winston-ts";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { OperationId } from "../generated/definitions/internal/OperationId";

import { LollipopAuthBearer as JWTAuthBearer } from "../generated/definitions/external/LollipopAuthBearer";
import { getGenerateJWT, getValidateJWT } from "./jwt_with_key_rotation";

import { JWTConfig } from "./config";

/**
 * Type Definitions
 */

export type AuthJWT = t.TypeOf<typeof AuthJWT>;
export const AuthJWT = t.interface({
  assertionRef: AssertionRef,
  operationId: OperationId
});

/**
 * AuthJWT Generation
 */
export type GenerateAuthJWT = (
  authJWT: AuthJWT
) => TE.TaskEither<Error, NonEmptyString>;

export const getGenerateAuthJWT = ({
  ISSUER,
  JWT_TTL,
  PRIMARY_PRIVATE_KEY
}: JWTConfig): GenerateAuthJWT =>
  pipe(
    getGenerateJWT(ISSUER, PRIMARY_PRIVATE_KEY),
    generateJWTFunction => (authJWT): ReturnType<GenerateAuthJWT> =>
      generateJWTFunction(authJWT, JWT_TTL as Second)
  );

/**
 * AuthJWT Validation
 */
export type ValidateAuthJWT = (
  token: NonEmptyString
) => TE.TaskEither<Error, AuthJWT>;

export const getValidateAuthJWT = ({
  ISSUER,
  PRIMARY_PUBLIC_KEY,
  SECONDARY_PUBLIC_KEY
}: JWTConfig): ValidateAuthJWT =>
  pipe(
    getValidateJWT(ISSUER, PRIMARY_PUBLIC_KEY, SECONDARY_PUBLIC_KEY),
    validateJWTFunction => (token): ReturnType<ValidateAuthJWT> =>
      pipe(
        validateJWTFunction(token),
        TE.filterOrElse(AuthJWT.is, () => E.toError("Invalid AuthJWT payload"))
      )
  );

/**
 * A middleware that verify the jwt and returns the payload
 *
 * @param jwtConfig the config for the jwt
 * */

export const verifyJWTMiddleware = (
  jwtConfig: JWTConfig,
  fnName: string
): IRequestMiddleware<"IResponseErrorForbiddenNotAuthorized", AuthJWT> => (
  req
  // TODO refactor in order to use this method witha generic type
): Promise<E.Either<IResponseErrorForbiddenNotAuthorized, AuthJWT>> =>
  pipe(
    req.headers[jwtConfig.BEARER_AUTH_HEADER],
    JWTAuthBearer.decode,
    eventLog.either.errorLeft(error => [
      `Invalid JWT`,
      {
        error: readableReportSimplified(error),
        jwt: req.headers[jwtConfig.BEARER_AUTH_HEADER],
        name: fnName,
        requestUrl: req.url
      }
    ]),
    E.mapLeft(_ =>
      getResponseErrorForbiddenNotAuthorized(
        `Invalid or missing JWT in header ${jwtConfig.BEARER_AUTH_HEADER}`
      )
    ),
    E.map(authBearer => authBearer.replace("Bearer ", "") as NonEmptyString),
    TE.fromEither,
    TE.chain(token =>
      pipe(
        token,
        getValidateAuthJWT(jwtConfig),
        eventLog.taskEither.errorLeft(error => [
          `JWT validation error`,
          {
            errorMessage: error.message,
            jwt: req.headers[jwtConfig.BEARER_AUTH_HEADER],
            name: fnName,
            requestUrl: req.url
          }
        ]),
        TE.mapLeft(_ =>
          getResponseErrorForbiddenNotAuthorized("Invalid or expired JWT")
        )
      )
    )
  )();
