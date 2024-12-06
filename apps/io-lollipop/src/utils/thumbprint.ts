import * as jose from "jose";
import * as TE from "fp-ts/TaskEither";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { flow } from "fp-ts/lib/function";
import { JwkPubKeyHashAlgorithm } from "../generated/definitions/internal/JwkPubKeyHashAlgorithm";

/**
 * Returns a function that take the input jwkPubKey and return its thumbprint encoded in base64.
 * The thumbprint is calculated using the input hash algo (default to sha256);
 *
 * @param algo the hash algorithm used to compute the thumbprint
 * @returns a function to calculate the thumprint
 */
export const calculateThumbprint = (algo?: JwkPubKeyHashAlgorithm) => (
  jwkPubKey: JwkPublicKey
): TE.TaskEither<Error, string> =>
  TE.tryCatch(
    () => jose.calculateJwkThumbprint(jwkPubKey, algo),
    err => new Error(`Can not calculate JwkThumbprint | ${err}`)
  );

/**
 * Format the input jwkPubKey in JSON and encode it in base64 (url compliant).
 *
 * @param jwkPubKey the public key in jwt format
 * @returns a base64 string (url compliant)
 */
export const encodeBase64: (jwkPubKey: JwkPublicKey) => string = flow(
  JSON.stringify,
  jose.base64url.encode
);
