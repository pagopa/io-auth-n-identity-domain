/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jwt from "jsonwebtoken";
import { ulid } from "ulid";

import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import { Second } from "@pagopa/ts-commons/lib/units";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { validateJWTWithKey } from "./validate_jwt_with_key";

// --------------------

export const alg = "RS256";

// -----------------------
// Public methods
// -----------------------

/**
 * JWT Generation
 */
export type GetGenerateJWT = <T extends Record<string, unknown>>(
  issuer: NonEmptyString,
  primaryPrivateKey: NonEmptyString
) => (payload: T, ttl: Second) => TE.TaskEither<Error, NonEmptyString>;

export const getGenerateJWT: GetGenerateJWT = (issuer, primaryPrivateKey) => (
  payload,
  ttl
): TE.TaskEither<Error, NonEmptyString> =>
  pipe(
    TE.taskify<Error, string>(cb =>
      jwt.sign(
        payload,
        primaryPrivateKey,
        {
          algorithm: alg,
          expiresIn: `${ttl} seconds`,
          issuer,
          jwtid: ulid()
        },
        cb
      )
    )(),
    TE.mapLeft(E.toError),
    TE.chain(
      TE.fromPredicate(NonEmptyString.is, () => E.toError("Token is empty."))
    )
  );

export const errorIsInvalidSignatureError = (error: Error): boolean =>
  error.message === "JsonWebTokenError - invalid signature";

/**
 * JWT Validation
 */
export type GetValidateJWT = (
  issuer: NonEmptyString,
  primaryPublicKey: NonEmptyString,
  secondaryPublicKey?: NonEmptyString
) => (token: NonEmptyString) => TE.TaskEither<Error, jwt.JwtPayload>;

export const getValidateJWT: GetValidateJWT = (
  issuer,
  primaryPublicKey,
  secondaryPublicKey
) => (token): TE.TaskEither<Error, jwt.JwtPayload> =>
  pipe(
    token,
    validateJWTWithKey(issuer, primaryPublicKey),
    TE.orElse(err =>
      pipe(
        secondaryPublicKey,
        O.fromNullable,
        O.chain(O.fromPredicate(() => errorIsInvalidSignatureError(err))),
        O.map(key => validateJWTWithKey(issuer, key)(token)),
        O.getOrElse(() => TE.left(err))
      )
    )
  );
