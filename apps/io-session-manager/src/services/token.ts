import * as crypto from "crypto";
import { promisify } from "util";
import {
  EmailString,
  FiscalCode,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { ulid } from "ulid";
import * as jwt from "jsonwebtoken";

/**
 * Generate a new opaque token of the provided length
 * @param length the required number of bytes of the token
 * @returns the opaque token
 */
export const getNewToken = (length: number): string =>
  // Use the crypto.randomBytes as token.
  crypto.randomBytes(length).toString("hex");

/**
 * Generate a new opaque token of the provided length
 * @param length the required number of bytes of the token
 * @returns a promise with the opaque token
 */
export const getNewTokenAsync = (length: number): Promise<string> =>
  promisify(crypto.randomBytes)(length).then((result) =>
    result.toString("hex"),
  );

/**
 * Generates a new zendesk support token containing the logged user's fiscalCode and email address.
 *
 * @param secret: The shared secret used to sign this JWT token
 * @param name: The logged user's first name
 * @param familyName: The logged user's last name
 * @param fiscalCode: The logged user's fiscal code
 * @param emailAddress: The logged user's email address
 * @param tokenTtl: Token Time To live (expressed in seconds)
 * @param issuer: The Token issuer
 */
export const getJwtZendeskSupportToken = (
  secret: NonEmptyString,
  name: NonEmptyString,
  familyName: NonEmptyString,
  fiscalCode: FiscalCode,
  emailAddress: EmailString,
  tokenTtl: Second,
  issuer: NonEmptyString,
): TE.TaskEither<Error, string> =>
  pipe(
    TE.taskify<Error, string>((cb) =>
      jwt.sign(
        {
          email: emailAddress,
          external_id: fiscalCode,
          iat: new Date().getTime() / 1000,
          jti: ulid(),
          name: `${name} ${familyName}`,
        },
        secret,
        {
          algorithm: "HS256",
          expiresIn: `${tokenTtl} seconds`,
          issuer,
        },
        cb,
      ),
    )(),
    TE.mapLeft(E.toError),
  );
