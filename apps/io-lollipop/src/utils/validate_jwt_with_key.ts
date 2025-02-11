import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";

import * as jwt from "jsonwebtoken";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";

import { alg } from "./jwt_with_key_rotation";

export const validateJWTWithKey: (
  issuer: NonEmptyString,
  key: NonEmptyString
) => (token: NonEmptyString) => TE.TaskEither<Error, jwt.JwtPayload> = (
  issuer,
  key
) => (token): TE.TaskEither<Error, jwt.JwtPayload> =>
  pipe(
    TE.tryCatch(
      () =>
        new Promise<jwt.JwtPayload>((resolve, reject) => {
          jwt.verify(
            token,
            key,
            { algorithms: [alg], issuer },
            (err, decoded) => {
              if (err) {
                reject(new Error(`${err.name} - ${err.message}`));
              } else if (!decoded) {
                reject("Unable to decode token");
              } else {
                resolve(decoded as jwt.JwtPayload);
              }
            }
          );
        }),
      E.toError
    )
  );
