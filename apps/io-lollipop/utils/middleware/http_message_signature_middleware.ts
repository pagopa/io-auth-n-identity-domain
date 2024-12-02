/* eslint-disable sort-keys */
// TODO: Move this file into io-functions-commons

import * as crypto_lib from "crypto";
import * as express from "express";
import { verifySignatureHeader } from "@mattrglobal/http-signatures";
import * as jwkToPem from "jwk-to-pem";

import { constFalse, constTrue, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as t from "io-ts";

import {
  JwkPublicKey,
  JwkPublicKeyFromToken
} from "@pagopa/ts-commons/lib/jwk";
import {
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { getAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import * as crypto from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import * as A from "fp-ts/Array";
import { JwkPubKeyToken } from "../../generated/definitions/internal/JwkPubKeyToken";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";

import { getCustomVerifyWithEncoding } from "../httpSignature.verifiers";
import { getAlgoFromAssertionRef } from "../lollipopKeys";

export const LollipopHeadersForSignature = t.intersection([
  t.type({
    ["x-pagopa-lollipop-public-key"]: JwkPubKeyToken,
    ["x-pagopa-lollipop-assertion-ref"]: AssertionRef
  }),
  t.partial({
    ["content-digest"]: NonEmptyString
  })
]);

export const isValidDigestHeader = (
  contentDigestHeader: string | undefined,
  body: Buffer | string
): boolean =>
  pipe(
    contentDigestHeader,
    E.fromNullable(new Error("Missing 'content-digest' header")),
    E.chain(contentDigest =>
      E.tryCatch(
        () => crypto.validateDigestHeader(contentDigest, body),
        E.toError
      )
    ),
    E.fold(constFalse, constTrue)
  );

export const validateHttpSignatureWithEconding = (
  dsaEncoding: crypto_lib.DSAEncoding
) => (
  request: express.Request,
  assertionRef: AssertionRef,
  publicKey: JwkPublicKey,
  body?: string
): TE.TaskEither<Error, true> =>
  pipe(
    TE.of(getAlgoFromAssertionRef(assertionRef)),
    TE.map(algo => `${algo}-`),
    TE.map(assertionRefPrefix => assertionRef.split(assertionRefPrefix)),
    TE.chain(
      flow(
        A.tail,
        TE.fromOption(() => new Error("Unexpected assertionRef")),
        TE.map(_ => _.join(""))
      )
    ),
    TE.map(thumbprint => ({
      httpHeaders: request.headers,
      url: request.url,
      method: request.method,
      body,
      verifier: {
        verify: getCustomVerifyWithEncoding(dsaEncoding)({
          [thumbprint]: {
            key: publicKey
          }
        })
      }
    })),
    TE.chain(params =>
      TE.tryCatch(async () => verifySignatureHeader(params), E.toError)
    ),
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

export const keyToPem = (key: JwkPublicKey): E.Either<Error, string> =>
  E.tryCatch(() => jwkToPem(key), E.toError);

/**
 *
 * @returns
 */
export const HttpMessageSignatureMiddleware = (): IRequestMiddleware<
  "IResponseErrorValidation" | "IResponseErrorInternal",
  true
> => async (
  request
): ReturnType<
  IRequestMiddleware<
    "IResponseErrorValidation" | "IResponseErrorInternal",
    true
  >
> =>
  pipe(
    getAppContext(request),
    E.fromOption(() =>
      ResponseErrorInternal("Cannot get context from request")
    ),
    E.map(context => context.bindings.req.rawBody),
    E.bindTo("rawBody"),
    E.bindW("lollipopHeaders", () =>
      pipe(
        request.headers,
        LollipopHeadersForSignature.decode,
        E.mapLeft(
          ResponseErrorFromValidationErrors(LollipopHeadersForSignature)
        )
      )
    ),
    E.filterOrElseW(
      ({ rawBody, lollipopHeaders }) =>
        rawBody || lollipopHeaders["content-digest"]
          ? isValidDigestHeader(lollipopHeaders["content-digest"], rawBody)
          : true,
      () =>
        ResponseErrorInternal(
          "The content-digest is empty or do not match the body"
        )
    ),
    TE.fromEither,
    TE.chainW(({ rawBody, lollipopHeaders }) =>
      pipe(
        lollipopHeaders["x-pagopa-lollipop-public-key"],
        JwkPublicKeyFromToken.decode,
        E.mapLeft(errors => new Error(readableReportSimplified(errors))),
        TE.fromEither,
        TE.map(
          key =>
            [
              request,
              lollipopHeaders["x-pagopa-lollipop-assertion-ref"],
              key,
              rawBody
            ] as const
        ),
        TE.chain(params =>
          // IO app is currently signing using 'der' algorithm only.
          // Anyway, a LC should be ready to verify 'ieee-p1363' algorithm too.
          pipe(
            validateHttpSignatureWithEconding("der")(...params),
            TE.orElse(() =>
              validateHttpSignatureWithEconding("ieee-p1363")(...params)
            )
          )
        ),
        TE.mapLeft(error =>
          ResponseErrorInternal(
            `Http Message Signature Validation failed: ${error.message}`
          )
        )
      )
    )
  )();
