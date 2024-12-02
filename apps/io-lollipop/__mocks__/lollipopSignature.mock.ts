import * as crypto from "crypto";
import * as express from "express";
import * as jose from "jose";

import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UrlFromString, ValidUrl } from "@pagopa/ts-commons/lib/url";

import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LollipopMethodEnum } from "../generated/definitions/lollipop-first-consumer/LollipopMethod";
import { AssertionTypeEnum } from "../generated/definitions/internal/AssertionType";

import { FirstLcAssertionClientConfig } from "../utils/config";

import {
  aFiscalCode,
  aValidJwk,
  aValidSha256AssertionRef,
  toEncodedJwk
} from "./lollipopPubKey.mock";
import {
  CreateSignatureHeaderOptions,
  createSignatureHeader
} from "@mattrglobal/http-signatures";

// -------------------------------------
// Private / Public ES256 Key Generation
// -------------------------------------

export const generateES256Key = async () => {
  const key = await jose.generateKeyPair("ES256");
  const pubKeyJwk = await jose.exportJWK(key.publicKey);
  const privateKeyJwk = await jose.exportJWK(key.privateKey);

  const thumbprintSha256 = `${await jose.calculateJwkThumbprint(
    pubKeyJwk,
    "sha256"
  )}`;

  return {
    encodedPubKey: toEncodedJwk(pubKeyJwk as any),
    privateKeyJwk,
    assertionRefSha256: `sha256-${thumbprintSha256}` as AssertionRef,
    thumbprintSha256
  };
};

// --------------------------------------
// Private / Public RSA Key Generation
// --------------------------------------

export const generateRSAKey = async () => {
  const key = await jose.generateKeyPair("RS256", {
    modulusLength: 2048
  });
  const pubKeyJwk = {
    ...(await jose.exportJWK(key.publicKey)),
    alg: "sha256"
  };
  const privateKeyJwk = {
    ...(await jose.exportJWK(key.privateKey)),
    alg: "sha256"
  };

  const thumbprintSha256 = `${await jose.calculateJwkThumbprint(
    pubKeyJwk,
    "sha256"
  )}`;

  return {
    encodedPubKey: toEncodedJwk(pubKeyJwk as any),
    privateKeyJwk,
    assertionRefSha256: `sha256-${thumbprintSha256}` as AssertionRef,
    thumbprintSha256
  };
};

// --------------------------------------
// end Private / Public Key
// --------------------------------------

export const aValidPayload = {
  message: "a valid message payload" as NonEmptyString
};

export const firstLcAssertionClientConfig: FirstLcAssertionClientConfig = {
  EXPECTED_FIRST_LC_ORIGINAL_METHOD: LollipopMethodEnum.POST,
  EXPECTED_FIRST_LC_ORIGINAL_URL: pipe(
    UrlFromString.decode("https://api-app.io.pagopa.it/first-lollipop/sign"),
    E.getOrElseW(() => {
      throw new Error("Error decoding url");
    })
  ),
  FIRST_LC_ASSERTION_CLIENT_BASE_URL: "assertionClientBaseUrl" as NonEmptyString,
  FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY: "aSubscriptionKey" as NonEmptyString,
  IDP_KEYS_BASE_URL: ("https://api.is.eng.pagopa.it/idp-keys" as unknown) as ValidUrl
};

export const validLollipopLCParamsHeaders = {
  ["x-pagopa-lollipop-assertion-ref"]: aValidSha256AssertionRef,
  ["x-pagopa-lollipop-assertion-type"]: AssertionTypeEnum.SAML,
  ["x-pagopa-lollipop-user-id"]: aFiscalCode,
  ["x-pagopa-lollipop-public-key"]: toEncodedJwk(aValidJwk),
  ["x-pagopa-lollipop-auth-jwt"]: "aValidJWT" as NonEmptyString
};

export const getValidLollipopLCParamsHeaders = (
  assertionRef: AssertionRef,
  encodedPubKey: NonEmptyString
) => ({
  ...validLollipopLCParamsHeaders,

  ["x-pagopa-lollipop-public-key"]: encodedPubKey,
  ["x-pagopa-lollipop-assertion-ref"]: assertionRef
});

// --------------------------------------------
// Signature methods
// --------------------------------------------

type SignFunction = (data: Uint8Array) => Promise<Uint8Array>;

/**
 * Create a signed LolliPoP request
 */
export const withLollipopSignature = (
  keyid: string,
  nonce: string,
  alg: string,
  privateKey: jose.JWK,
  sign: (privateKey: jose.JWK) => SignFunction
) => async (request: express.Request): Promise<express.Request> => {
  const signWithPrivateKey = sign(privateKey);

  const method = request?.method ?? "GET";
  const url = request.url;

  const lollipopHttpHeaders = {
    ["x-pagopa-lollipop-original-method"]: method,
    ["x-pagopa-lollipop-original-url"]: url
  };

  const prevHeaders = getHeadersAsObject(request);

  const bodyCovered: string[] = request?.body ? ["content-digest"] : [];

  const options: CreateSignatureHeaderOptions = {
    alg: alg as any,
    nonce,
    signer: { keyid, sign: signWithPrivateKey },
    url,
    method,
    httpHeaders: { ...prevHeaders, ...lollipopHttpHeaders },
    body: request?.body ? (request?.body as string) : undefined,
    coveredFields: [
      ...bodyCovered,
      "x-pagopa-lollipop-original-method",
      "x-pagopa-lollipop-original-url"
    ].map(v => [v.toLowerCase(), new Map()])
  };

  const result = await createSignatureHeader(options);

  if (result.isErr()) {
    throw Error(result.error.message);
  }

  const signatureResult = result.value;

  return ({
    ...request,
    headers: {
      ...prevHeaders,
      ...lollipopHttpHeaders,
      ...(signatureResult.digest
        ? { ["content-digest"]: signatureResult.digest }
        : {}),
      ["Signature"]: signatureResult.signature,
      ["Signature-Input"]: signatureResult.signatureInput
    }
  } as any) as express.Request;
};

/**
 * Create a signed request for io-sign header
 */
export const withIoSignLollipopSignature = (
  keyid: string,
  nonce: string,
  alg: string,
  privateKey: jose.JWK,
  sign: (privateKey: jose.JWK) => SignFunction
) => async (request: express.Request): Promise<express.Request> => {
  if (!(request?.headers && "X-io-sign-qtspclauses" in request?.headers))
    throw new Error("Missing X-io-sign-qtspclauses in headers");

  const signWithPrivateKey = sign(privateKey);

  const method = request?.method ?? "GET";
  const url = request.url;

  const prevHeaders = getHeadersAsObject(request);

  const options: CreateSignatureHeaderOptions = {
    alg: alg as any,
    nonce,
    signer: { keyid, sign: signWithPrivateKey },
    url,
    method,
    httpHeaders: prevHeaders,
    body: request?.body ? (request?.body as string) : undefined,
    coveredFields: ["X-io-sign-qtspclauses"].map(v => [
      v.toLowerCase(),
      new Map()
    ])
  };

  const result = await createSignatureHeader(options);

  if (result.isErr()) {
    throw Error(result.error.message);
  }

  const signatureResult = result.value;

  return ({
    ...request,
    headers: {
      ...prevHeaders,
      ["Signature"]: signatureResult.signature,
      ["Signature-Input"]: signatureResult.signatureInput
    }
  } as any) as express.Request;
};

// ------------------------

export const signEcdsaSha256WithEncoding = (
  dsaEncoding: "der" | "ieee-p1363"
) => (key: crypto.JsonWebKey) => async (
  data: Uint8Array
): Promise<Uint8Array> => {
  const keyObject = crypto.createPrivateKey({ key, format: "jwk" });
  return crypto
    .createSign("SHA256")
    .update(data)
    .sign({ key: keyObject, dsaEncoding });
};

export const signRsaPssSha256WithEncoding = (
  dsaEncoding: "der" | "ieee-p1363"
) => (key: crypto.JsonWebKey) => async (
  data: Uint8Array
): Promise<Uint8Array> => {
  const keyObject = crypto.createPrivateKey({ key, format: "jwk" });
  return await crypto
    .createSign("SHA256")
    .update(data)
    .sign({
      key: keyObject,
      dsaEncoding,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING
    });
};

// ------------------------------
// Private methods
// ------------------------------

const getHeadersAsObject = (request: express.Request) =>
  request?.headers
    ? Object.keys(request.headers).reduce(
        (p, c) => ({
          ...p,
          [c]: (request.headers as Record<string, string>)[c]
        }),
        {}
      )
    : {};
