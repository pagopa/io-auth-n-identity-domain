import * as crypto_lib from "crypto";
import { verifySignatureHeader } from "@mattrglobal/http-signatures";
import * as TE from "fp-ts/TaskEither";
import * as H from "@pagopa/handler-kit";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as A from "fp-ts/Array";
import * as jose from "jose";
import { AssertionRef } from "../../generated/definitions/fn-lollipop/AssertionRef";
import { JwkPubKeyHashAlgorithm } from "../../types/lollipop";
import { CustomHttpUnauthorizedError } from "../errors";
import { getCustomVerifyWithEncoding } from "./httpSignature.verifiers";
import { getAlgoFromAssertionRef } from "./assertion";

type ValidateHttpSignatureParams = {
  readonly request: H.HttpRequest;
  readonly assertionRef: AssertionRef;
  readonly publicKey: JwkPublicKey;
  readonly body?: string;
};

export const validateHttpSignatureWithEconding = (
  dsaEncoding: crypto_lib.DSAEncoding
) => (params: ValidateHttpSignatureParams): TE.TaskEither<Error, true> =>
  pipe(
    params.assertionRef,
    getAlgoFromAssertionRef,
    algo => `${algo}-`,
    assertionRefPrefix => params.assertionRef.split(assertionRefPrefix),
    flow(
      A.tail,
      TE.fromOption(() => new Error("Unexpected assertionRef")),
      TE.map(_ => _.join(""))
    ),
    TE.map(thumbprint => ({
      body: params.body,
      httpHeaders: params.request.headers,
      method: params.request.method,
      url: params.request.url,
      verifier: {
        verify: getCustomVerifyWithEncoding(dsaEncoding)({
          [thumbprint]: {
            key: params.publicKey
          }
        })
      }
    })),
    TE.chain(p => TE.tryCatch(async () => verifySignatureHeader(p), E.toError)),
    TE.map(res =>
      res.map(r =>
        r.verified
          ? TE.of(true as const)
          : TE.left(
              new Error(
                `HTTP Request Signature failed ${JSON.stringify(r.reason)}`
              )
            )
      )
    ),
    TE.chainW(res =>
      res.unwrapOr(
        TE.left(new Error("An error occurred during signature check"))
      )
    )
  );

export const validateHttpSignature = (
  params: ValidateHttpSignatureParams
): TE.TaskEither<H.HttpUnauthorizedError, true> =>
  pipe(
    pipe(
      validateHttpSignatureWithEconding("der")(params),
      TE.orElse(() => validateHttpSignatureWithEconding("ieee-p1363")(params))
    ),
    TE.mapLeft(
      () => new CustomHttpUnauthorizedError("Invalid Lollipop Signature")
    )
  );

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
