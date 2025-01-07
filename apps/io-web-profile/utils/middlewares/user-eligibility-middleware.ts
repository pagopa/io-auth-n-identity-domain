import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as jwt from "jsonwebtoken";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  getResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";

import * as t from "io-ts";
import { AuthBearer } from "../../generated/definitions/external/AuthBearer";
import { IConfig } from "../config";
import { getIsUserElegibleIoWebProfile } from "../featureFlags/userEligibleForIoWebProfile";

const JWTWithFiscalCode = t.type({
  fiscal_number: FiscalCode
});

/**
 * Type Definitions
 */

export type UserEligibleJWT = (
  token: NonEmptyString
) => TE.TaskEither<Error, boolean>;

export const userIsEligible = (
  token: NonEmptyString,
  config: IConfig
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): UserEligibleJWT => () =>
  pipe(
    jwt.decode(token),
    JWTWithFiscalCode.decode,
    TE.fromEither,
    TE.mapLeft(() => new Error("Unable to decode JWT")),
    TE.chainW(
      flow(
        jwtDecoded =>
          getIsUserElegibleIoWebProfile(
            config.BETA_TESTERS,
            config.FF_API_ENABLED
          )(jwtDecoded.fiscal_number),
        TE.fromPredicate(identity, () => new Error("User is not eligible"))
      )
    )
  );

export const verifyUserEligibilityMiddleware = (
  config: IConfig
): IRequestMiddleware<"IResponseErrorForbiddenNotAuthorized", boolean> => (
  req
): Promise<E.Either<IResponseErrorForbiddenNotAuthorized, boolean>> =>
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
    TE.chain(token =>
      pipe(
        token,
        userIsEligible(token, config),
        TE.mapLeft(_ =>
          getResponseErrorForbiddenNotAuthorized("API are now on Closed Beta")
        )
      )
    )
  )();
