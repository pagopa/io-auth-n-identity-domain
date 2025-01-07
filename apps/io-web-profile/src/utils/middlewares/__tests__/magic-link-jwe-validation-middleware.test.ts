import * as crypto from "crypto";
import { addSeconds, getUnixTime, subSeconds } from "date-fns";
import * as express from "express";
import * as jose from "jose";

import { config } from "../../../__mocks__/config.mock";
import { magicLinkJweValidationMiddleware } from "../magic-link-jwe-validation-middleware";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const aJwePayload = {
  family_name: "fn",
  fiscal_number: "ISPXNB32R82Y766D",
  name: "name",
  jti: "AAAAAAAAA"
};
const jweProtectedHeader = {
  alg: "ECDH-ES+A256KW",
  crv: "P-256",
  enc: "A128CBC-HS256",
  kty: "EC"
};
const jweIssuer = config.MAGIC_LINK_JWE_ISSUER;

describe("MagicLinkJweValidationMiddleware", () => {
  const today = new Date();
  const primaryPublicKey = crypto.createPublicKey(
    config.MAGIC_LINK_JWE_PRIMARY_PUB_KEY
  );
  const secondaryPublicKey = crypto.createPublicKey(
    config.MAGIC_LINK_JWE_SECONDARY_PUB_KEY as NonEmptyString
  );

  it("GIVEN a valid jwePayload WHEN magicLinkJweValidationMiddleware is called THEN it should return a valid response", async () => {
    const token = await new jose.EncryptJWT(aJwePayload)
      .setProtectedHeader(jweProtectedHeader)
      .setIssuer(jweIssuer)
      .setIssuedAt()
      .setExpirationTime(getUnixTime(addSeconds(today, 3000)))
      .encrypt(primaryPublicKey);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    const middleware = getMagicLinkValidationMiddleware();

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Right",
      right: aJwePayload
    });
  });

  it("GIVEN a valid jwePayload generated with secondary key WHEN magicLinkJweValidationMiddleware is called THEN it should return a valid response", async () => {
    const token = await new jose.EncryptJWT(aJwePayload)
      .setProtectedHeader(jweProtectedHeader)
      .setIssuer(jweIssuer)
      .setIssuedAt()
      .setExpirationTime(getUnixTime(addSeconds(today, 3000)))
      .encrypt(secondaryPublicKey);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    const middleware = getMagicLinkValidationMiddleware();

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Right",
      right: aJwePayload
    });
  });

  it("GIVEN an expired jwePayload WHEN magicLinkJweValidationMiddleware is called THEN it should return an error", async () => {
    const token = await new jose.EncryptJWT(aJwePayload)
      .setProtectedHeader(jweProtectedHeader)
      .setIssuer(jweIssuer)
      .setIssuedAt()
      .setExpirationTime(getUnixTime(subSeconds(today, 1)))
      .encrypt(primaryPublicKey);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    const middleware = getMagicLinkValidationMiddleware();

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(`Error decrypting Magic Link JWE`)
      })
    });
  });

  it("GIVEN an invalid jwePayload WHEN magicLinkJweValidationMiddleware is called THEN it should return an error", async () => {
    const token = await new jose.EncryptJWT(aJwePayload)
      .setProtectedHeader(jweProtectedHeader)
      .setIssuer("INVALIDISSUER")
      .setIssuedAt()
      .setExpirationTime(getUnixTime(addSeconds(today, 3000)))
      .encrypt(primaryPublicKey);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    const middleware = getMagicLinkValidationMiddleware();

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(`Error decrypting Magic Link JWE`)
      })
    });
  });

  it("GIVEN a valid jwePayload WHEN the JTI is blacklisted THEN it should return an error", async () => {
    const token = await new jose.EncryptJWT(aJwePayload)
      .setProtectedHeader(jweProtectedHeader)
      .setIssuer(jweIssuer)
      .setIssuedAt()
      .setExpirationTime(getUnixTime(addSeconds(today, 3000)))
      .encrypt(primaryPublicKey);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    const middleware = getMagicLinkValidationMiddleware([aJwePayload.jti]);

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(`Blacklisted token`)
      })
    });
  });
});

const getMagicLinkValidationMiddleware = (
  blacklist?: ReadonlyArray<string>
) => {
  return magicLinkJweValidationMiddleware(
    config.BEARER_AUTH_HEADER,
    config.MAGIC_LINK_JWE_ISSUER,
    blacklist || config.BLACKLISTED_JTI_LIST,
    config.MAGIC_LINK_JWE_PRIMARY_PRIVATE_KEY,
    config.MAGIC_LINK_JWE_SECONDARY_PRIVATE_KEY
  );
};
