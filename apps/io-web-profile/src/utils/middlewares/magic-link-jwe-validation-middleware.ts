import * as E from "fp-ts/Either";

import { IRequestMiddleware } from "@pagopa/ts-commons/lib/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  getResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { AuthBearer } from "../../generated/definitions/external/AuthBearer";
import { MagicLinkPayload } from "../exchange-jwt";
import { getValidateJWE } from "../jwe";

export const magicLinkJweValidation = (
  issuer: NonEmptyString,
  blacklistedJTIList: ReadonlyArray<string>,
  primaryPrivateKey: NonEmptyString,
  secondaryPrivateKey?: NonEmptyString
) => (
  token: NonEmptyString
): TE.TaskEither<IResponseErrorForbiddenNotAuthorized, MagicLinkPayload> =>
  pipe(
    getValidateJWE(issuer, primaryPrivateKey, secondaryPrivateKey)(token),
    TE.chain(
      TE.fromPredicate(
        _ => !blacklistedJTIList.includes(_.jti),
        () => new Error("Blacklisted token")
      )
    ),
    TE.mapLeft(error => getResponseErrorForbiddenNotAuthorized(error.message))
  );

export const magicLinkJweValidationMiddleware = (
  authHeader: NonEmptyString,
  issuer: NonEmptyString,
  blacklistedJTIList: ReadonlyArray<string>,
  primaryPrivateKey: NonEmptyString,
  secondaryPrivateKey?: NonEmptyString
): IRequestMiddleware<
  "IResponseErrorForbiddenNotAuthorized",
  MagicLinkPayload
> => (
  req
): Promise<E.Either<IResponseErrorForbiddenNotAuthorized, MagicLinkPayload>> =>
  pipe(
    req.headers[authHeader],
    AuthBearer.decode,
    E.mapLeft(_ =>
      getResponseErrorForbiddenNotAuthorized(
        `Invalid or missing JWE in header ${authHeader}`
      )
    ),
    E.map(authBearer => authBearer.replace("Bearer ", "") as NonEmptyString),
    TE.fromEither,
    TE.chain(token =>
      magicLinkJweValidation(
        issuer,
        blacklistedJTIList,
        primaryPrivateKey,
        secondaryPrivateKey
      )(token)
    )
  )();
