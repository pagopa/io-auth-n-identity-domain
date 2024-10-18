import {
  AlgorithmTypes,
  CreateSignatureHeaderOptions,
  algMap,
  createSignatureHeader
} from "@mattrglobal/http-signatures";
import * as jose from "jose";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as B from "fp-ts/boolean";
import * as t from "io-ts";
import { pipe, flow } from "fp-ts/function";
import * as AP from "fp-ts/Apply";
import {
  LollipopMethod,
  LollipopMethodEnum
} from "../generated/lollipop_definitions/LollipopMethod";
import { LollipopOriginalURL } from "../generated/lollipop_definitions/LollipopOriginalURL";
import { randomUUID } from "crypto";
import { Json } from "fp-ts/lib/Json";
import { parseJwkOrError } from "@pagopa/ts-commons/lib/jwk";

type lolliPopDynamicHeaders = {
  digest?: string;
  signature: string;
  signatureInput: string;
};
export type CreateLollipopHeaders = (input: {
  method?: LollipopMethod;
  url: LollipopOriginalURL;
  body?: Json;
  nonce?: string;
  headers?: Record<string, unknown>;
  privateKeyJwk: jose.JWK;
  publicKeyJwk: jose.JWK;
}) => TE.TaskEither<Error, lolliPopDynamicHeaders>;
export const createLollipopHeaders: CreateLollipopHeaders = input => {
  const method = input?.method ?? LollipopMethodEnum.GET;
  const url = input.url;
  const alg = AlgorithmTypes["ecdsa-p256-sha256"];
  const sign = algMap[alg].sign(input.privateKeyJwk);
  const lollipopHttpHeaders = {
    ["x-pagopa-lollipop-original-method"]: method,
    ["x-pagopa-lollipop-original-url"]: url
  };
  const bodyCovered: string[] = input?.body ? ["content-digest"] : [];

  return pipe(
    TE.Do,
    TE.bind("keyid", () =>
      pipe(
        TE.tryCatch(
          () => jose.calculateJwkThumbprint(input.publicKeyJwk, "sha256"),
          E.toError
        ),
        TE.mapLeft(e => new Error(`Error while creating key thumbprint: ${e}`))
      )
    ),
    TE.bind("options", ({ keyid }) =>
      TE.right({
        alg,
        nonce: input.nonce,
        signer: { keyid, sign },
        url,
        method,
        httpHeaders: { ...input.headers, ...lollipopHttpHeaders },
        body: input?.body ? (input?.body as string) : undefined,
        coveredFields: [
          ...bodyCovered,
          "x-pagopa-lollipop-original-method",
          "x-pagopa-lollipop-original-url"
        ].map(v => [v.toLowerCase(), new Map()])
      } as CreateSignatureHeaderOptions)
    ),
    TE.chain(({ options }) =>
      pipe(
        TE.tryCatch(() => createSignatureHeader(options), E.toError),
        TE.chain(result =>
          result.isOk()
            ? TE.right(result.value)
            : TE.left(
                new Error(
                  `Error while creating lollipop headers: ${result.error.message}`
                )
              )
        )
      )
    )
  );
};

export const wrappedExportJwk = (key: jose.KeyLike) =>
  TE.tryCatch(() => jose.exportJWK(key), E.toError);

export enum LollipopSupportedKey {
  "RSA" = "RS256",
  "NIST_P-256" = "ES256"
}
export const LollipopSupportedKeyAlgorithms = t.union([
  t.literal(LollipopSupportedKey.RSA),
  t.literal(LollipopSupportedKey["NIST_P-256"])
]);
export type LollipopSupportedKeyAlgorithms = t.TypeOf<
  typeof LollipopSupportedKeyAlgorithms
>;
export const createKeyPairJWKTE = (algorithm: LollipopSupportedKeyAlgorithms) =>
  pipe(
    TE.tryCatch(() => jose.generateKeyPair(algorithm), E.toError),
    TE.chain(keys =>
      AP.sequenceS(TE.ApplyPar)({
        privateKeyJwk: wrappedExportJwk(keys.privateKey),
        publicKeyJwk: pipe(
          wrappedExportJwk(keys.publicKey),
          // BUG: although the alg field is optional in RFC 7518,
          // this is required for the backend in order to work
          TE.map(jwk =>
            pipe(
              algorithm === LollipopSupportedKey.RSA,
              B.fold(
                () => jwk,
                () => ({ ...jwk, alg: LollipopSupportedKey.RSA })
              )
            )
          )
        )
      })
    )
  );

const base64urltoJWK: (input: string) => E.Either<Error, jose.JWK> = flow(
  // in opposite of what the library shows, the following method can also parse a JWK of a private key
  parseJwkOrError,
  //TODO: remove casting with custom type decode
  E.map(e => e as jose.JWK)
);

export const importBase64UrlJWKTE = (input: string) =>
  pipe(input.trim().split("#"), base64urlKeys =>
    AP.sequenceS(E.Apply)({
      publicKeyJwk: base64urltoJWK(base64urlKeys[0]),
      privateKeyJwk: base64urltoJWK(base64urlKeys[1])
    })
  );

export const getErrorOrEncodedJwk = (key: jose.JWK) =>
  E.tryCatch(() => jose.base64url.encode(JSON.stringify(key)), E.toError);

export const getThumbrint = (key: jose.JWK) =>
  TE.tryCatch(() => jose.calculateJwkThumbprint(key), E.toError);

export const createUUIDV4Nonce = () =>
  randomUUID({ disableEntropyCache: true });
