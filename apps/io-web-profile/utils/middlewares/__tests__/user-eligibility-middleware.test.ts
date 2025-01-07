import * as express from "express";
import * as E from "fp-ts/Either";
import { sign } from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { config, hslConfig } from "../../../__mocks__/config.mock";
import {
  userIsEligible,
  verifyUserEligibilityMiddleware
} from "../user-eligibility-middleware";
import { FeatureFlagEnum } from "../../featureFlags/featureFlags";

describe(`userIsEligible`, () => {
  it("should succeed in passing the user as eligible", async () => {
    const token = hslConfig.HUB_SPID_LOGIN_MOCK_TOKEN as NonEmptyString;
    const user = await userIsEligible(token, config)(token)();

    expect(E.isRight(user)).toBeTruthy();
    if (E.isRight(user)) {
      expect(user.right).toBe(true);
    }
  });

  it("should return false if the user is not eligible for BETA", async () => {
    config.FF_API_ENABLED = FeatureFlagEnum.BETA;
    const token = getToken("ISPXNB32R82Y766X");
    const user = await userIsEligible(token, config)(token)();

    expect(E.isLeft(user)).toBeTruthy();
  });
});

describe(`verifyUserEligibilityMiddleware`, () => {
  it("\
      GIVEN a Valid jwtConfig and a valid authorization\
      WHEN verifyUserEligibilityMiddleware is called\
      THEN it should return user as eligible\
      ", async () => {
    const token = hslConfig.HUB_SPID_LOGIN_MOCK_TOKEN as NonEmptyString;

    const middleware = verifyUserEligibilityMiddleware(config);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Right",
      right: true
    });
  });

  it("\
      GIVEN a Valid jwtConfig and an empty authorization\
      WHEN verifyUserEligibilityMiddleware is called\
      THEN it should return a IResponseErrorForbiddenNotAuthorized\
      ", async () => {
    const middleware = verifyUserEligibilityMiddleware(config);

    const mockReq = ({
      headers: {
        authorization: ``
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(
          `Invalid or missing JWT in header ${config.BEARER_AUTH_HEADER}`
        )
      })
    });
  });

  it("\
      GIVEN a Valid jwtConfig and an invalid authorization header\
      WHEN verifyUserEligibilityMiddleware is called\
      THEN it should return a IResponseErrorForbiddenNotAuthorized\
      ", async () => {
    const middleware = verifyUserEligibilityMiddleware(config);

    const mockReq = ({
      headers: {
        authorization: `token`
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(
          `Invalid or missing JWT in header ${config.BEARER_AUTH_HEADER}`
        )
      })
    });
  });

  it("\
      GIVEN a Valid jwtConfig and a valid authorization not in BETA testers\
      WHEN verifyUserEligibilityMiddleware is called\
      THEN it should return user as not eligible\
      ", async () => {
    const token = getToken("ISPXNB32R82Y766X");
    config.FF_API_ENABLED = FeatureFlagEnum.BETA;
    const middleware = verifyUserEligibilityMiddleware(config);

    const mockReq = ({
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(`API are now on Closed Beta`)
      })
    });
  });
});

// -------------------
// private methods
// -------------------

const getToken = (fiscal_code: string): NonEmptyString => {
  const {
    privateKey: hslPrivateKey,
    publicKey: hslPublicKey
  } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });

  const jwt = sign(
    {
      name: "aName",
      family_name: "aFamilyName",
      fiscal_number: fiscal_code
    },
    hslPrivateKey,
    { algorithm: "RS256", issuer: "SPID" }
  );

  return jwt as NonEmptyString;
};
