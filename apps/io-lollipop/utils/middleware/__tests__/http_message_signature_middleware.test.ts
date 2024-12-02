import * as express from "express";

import * as E from "fp-ts/Either";
import { AlgorithmTypes } from "@mattrglobal/http-signatures";

import { HttpMessageSignatureMiddleware } from "../http_message_signature_middleware";
import {
  aValidPayload,
  generateES256Key,
  generateRSAKey,
  getValidLollipopLCParamsHeaders,
  signEcdsaSha256WithEncoding,
  signRsaPssSha256WithEncoding,
  validLollipopLCParamsHeaders,
  withIoSignLollipopSignature,
  withLollipopSignature
} from "../../../__mocks__/lollipopSignature.mock";
import { aValidSha512AssertionRef } from "../../../__mocks__/lollipopPubKey.mock";

const baseReq = ({
  app: {
    get: () => ({
      bindings: {
        req: { rawBody: JSON.stringify(aValidPayload) }
      }
    })
  },
  url:
    "https://io-p-weu-lollipop-fn.azurewebsites.net/api/v1/first-lollipop-consumer",
  method: "POST",
  body: aValidPayload
} as unknown) as express.Request;

describe("HttpMessageSignatureMiddleware - Success", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`GIVEN a request with a signature
  WHEN the signature is valid, encoding is 'ieee-p1363' and alg is 'ecdsa-p256-sha256'
  THEN the middleware return true`, async () => {
    const data = await generateES256Key();

    const mockReq = ({
      ...baseReq,
      headers: getValidLollipopLCParamsHeaders(
        data.assertionRefSha256,
        data.encodedPubKey
      )
    } as unknown) as express.Request;

    const mockReqWithSignedParams = await withLollipopSignature(
      data.thumbprintSha256,
      "a nonce",
      AlgorithmTypes["ecdsa-p256-sha256"],
      data.privateKeyJwk,
      signEcdsaSha256WithEncoding("ieee-p1363")
    )(mockReq);

    const res = await HttpMessageSignatureMiddleware()(mockReqWithSignedParams);

    expect(res).toMatchObject(E.right(true));
  });

  test(`GIVEN a request with a signature
  WHEN the signature is valid, encoding is 'ieee-p1363' and alg is 'rsa-pss-sha256'
  THEN the middleware return true`, async () => {
    const data = await generateRSAKey();

    const mockReq = ({
      ...baseReq,
      headers: getValidLollipopLCParamsHeaders(
        data.assertionRefSha256,
        data.encodedPubKey
      )
    } as unknown) as express.Request;

    const mockReqWithSignedParams = await withLollipopSignature(
      data.thumbprintSha256,
      "a nonce",
      "rsa-pss-sha256",
      data.privateKeyJwk,
      signRsaPssSha256WithEncoding("ieee-p1363")
    )(mockReq);

    const res = await HttpMessageSignatureMiddleware()(mockReqWithSignedParams);
    expect(res).toMatchObject(E.right(true));
  });

  test(`GIVEN a request with a multi-signature
  WHEN all the signatures are valid, encoding is 'ieee-p1363' and alg is 'ecdsa-p256-sha256'
  THEN the middleware return true`, async () => {
    const data = await generateES256Key();

    const mockReq = ({
      ...baseReq,
      headers: {
        ...getValidLollipopLCParamsHeaders(
          data.assertionRefSha256,
          data.encodedPubKey
        ),
        "X-io-sign-qtspclauses": "a value"
      }
    } as unknown) as express.Request;

    const alg = AlgorithmTypes["ecdsa-p256-sha256"];
    const mockReqWith2ndSignedParams = await withIoSignLollipopSignature(
      data.thumbprintSha256,
      "a nonce",
      alg,
      data.privateKeyJwk,
      signEcdsaSha256WithEncoding("ieee-p1363")
    )(mockReq);
    const mockReqWithSignedParams = await withLollipopSignature(
      data.thumbprintSha256,
      "another nonce",
      alg,
      data.privateKeyJwk,
      signEcdsaSha256WithEncoding("ieee-p1363")
    )(mockReqWith2ndSignedParams);

    const res = await HttpMessageSignatureMiddleware()(mockReqWithSignedParams);

    expect(res).toMatchObject(E.right(true));
  });

  test(`GIVEN a request with a signature
  WHEN the signature is valid, encoding is 'der' and alg is 'ecdsa-p256-sha256'
  THEN the middleware return true`, async () => {
    const data = await generateES256Key();

    const mockReq = ({
      ...baseReq,
      headers: getValidLollipopLCParamsHeaders(
        data.assertionRefSha256,
        data.encodedPubKey
      )
    } as unknown) as express.Request;

    const mockReqWithSignedParams = await withLollipopSignature(
      data.thumbprintSha256,
      "a nonce",
      AlgorithmTypes["ecdsa-p256-sha256"],
      data.privateKeyJwk,
      signEcdsaSha256WithEncoding("der")
    )(mockReq);

    const res = await HttpMessageSignatureMiddleware()(mockReqWithSignedParams);

    expect(res).toMatchObject(E.right(true));
  });
});

describe("HttpMessageSignatureMiddleware - Failures", () => {
  test(`GIVEN a request with a signature
  WHEN the keyid is different from the assertion ref
  THEN the middleware return false`, async () => {
    const data = await generateES256Key();

    const mockReq = ({
      ...baseReq,
      headers: {
        ...validLollipopLCParamsHeaders,
        ["x-pagopa-lollipop-assertion-ref"]: aValidSha512AssertionRef
      }
    } as unknown) as express.Request;

    const mockReqWithSignedParams = await withLollipopSignature(
      data.thumbprintSha256,
      "a nonce",
      AlgorithmTypes["ecdsa-p256-sha256"],
      data.privateKeyJwk,
      signEcdsaSha256WithEncoding("ieee-p1363")
    )(mockReq);
    const res = await HttpMessageSignatureMiddleware()(mockReqWithSignedParams);

    expect(res).toMatchObject(
      E.left(
        expect.objectContaining({
          detail:
            'Internal server error: Http Message Signature Validation failed: HTTP Request Signature failed {"type":"FailedToVerify","message":"Signatures are well formed but one or more failed to verify."}',
          kind: "IResponseErrorInternal"
        })
      )
    );
  });
});
