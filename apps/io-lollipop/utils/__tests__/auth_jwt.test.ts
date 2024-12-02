import * as jwt from "jsonwebtoken";
import * as express from "express";
import * as E from "fp-ts/Either";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  AuthJWT,
  getGenerateAuthJWT,
  getValidateAuthJWT,
  verifyJWTMiddleware
} from "../auth_jwt";

import { JWTConfig } from "../config";

import { aPrimaryKey, aSecondaryKey } from "../../__mocks__/keys";
import { getGenerateJWT } from "../jwt_with_key_rotation";
import { Second } from "@pagopa/ts-commons/lib/units";
import { pipe } from "fp-ts/lib/function";

const issuer = "test-issuer" as NonEmptyString;
const standardJWTTTL = 900 as Second;

const aPayload = {
  assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
  operationId: "anOperationId"
} as AuthJWT;

const aConfigWithPrimaryKey = pipe(
  JWTConfig.decode({
    ISSUER: issuer,
    PRIMARY_PRIVATE_KEY: aPrimaryKey.privateKey,
    PRIMARY_PUBLIC_KEY: aPrimaryKey.publicKey,
    BEARER_AUTH_HEADER: "x-pagopa-lollipop-auth"
  }),
  E.getOrElseW(_ => {
    throw Error("Cannot decode IConfig " + JSON.stringify(_));
  })
);

const aConfigWithTwoPrimaryKeys = {
  ...aConfigWithPrimaryKey,
  SECONDARY_PUBLIC_KEY: aSecondaryKey.publicKey
};

describe("getGenerateJWT", () => {
  it("should generate a valid AuthJWT", async () => {
    const generateJWT = getGenerateAuthJWT(aConfigWithPrimaryKey);

    const res = await generateJWT(aPayload)();

    expect(res).toMatchObject(
      E.right(expect.stringMatching(`[A-Za-z0-9-_]{1,520}`))
    );
  });
});

describe("getValidateJWT - Success", () => {
  it("should succeed validating a valid JWT", async () => {
    // Setup
    const generateJWT = getGenerateAuthJWT(aConfigWithPrimaryKey);
    const token = await generateJWT(aPayload)();

    expect(E.isRight(token)).toBeTruthy();
    if (E.isRight(token)) {
      // Test
      const result = await getValidateAuthJWT(aConfigWithPrimaryKey)(
        token.right
      )();
      checkDecodedToken(result);
    }
  });
});

describe("getValidateJWT - Failures", () => {
  it("should  fail validating a JWT with invalid payload", async () => {
    // Setup
    const generateJWT = getGenerateJWT(
      aConfigWithPrimaryKey.ISSUER,
      aConfigWithPrimaryKey.PRIMARY_PRIVATE_KEY
    );
    const token = await generateJWT({ a: "a", b: 1 }, standardJWTTTL)();

    expect(E.isRight(token)).toBeTruthy();
    if (E.isRight(token)) {
      // Test
      const result = await getValidateAuthJWT(aConfigWithPrimaryKey)(
        token.right
      )();

      expect(result).toMatchObject(
        E.left(E.toError("Invalid AuthJWT payload"))
      );
    }
  });
});

describe("VerifyJWTMiddleware", () => {
  it("\
    GIVEN a Valid jwtConfig and a valid x-pagopa-lollipop-auth\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a valid AuthJWT\
    ", async () => {
    const authJwt = await getGenerateAuthJWT(aConfigWithPrimaryKey)(aPayload)();
    expect(E.isRight(authJwt)).toBeTruthy();

    const middleware = verifyJWTMiddleware(
      aConfigWithTwoPrimaryKeys,
      "function-Name"
    );

    if (E.isRight(authJwt)) {
      const mockReq = ({
        headers: {
          "x-pagopa-lollipop-auth": `Bearer ${authJwt.right}`
        }
      } as unknown) as express.Request;

      await expect(middleware(mockReq)).resolves.toMatchObject({
        _tag: "Right",
        right: expect.objectContaining({
          assertionRef: aPayload.assertionRef,
          operationId: aPayload.operationId,
          iss: aConfigWithTwoPrimaryKeys.ISSUER
        })
      });
    }
  });

  it("\
    GIVEN a Valid jwtConfig and an empty x-pagopa-lollipop-auth\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a IResponseErrorForbiddenNotAuthorized\
    ", async () => {
    const middleware = verifyJWTMiddleware(
      aConfigWithTwoPrimaryKeys,
      "function-Name"
    );

    const mockReq = ({
      headers: {
        "x-pagopa-lollipop-auth": ""
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(
          `Invalid or missing JWT in header ${aConfigWithTwoPrimaryKeys.BEARER_AUTH_HEADER}`
        )
      })
    });
  });

  it("\
    GIVEN a Valid jwtConfig and an invalid x-pagopa-lollipop-auth\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a IResponseErrorForbiddenNotAuthorized\
    ", async () => {
    const invalidAuth = "invalidAuth";

    const middleware = verifyJWTMiddleware(
      aConfigWithTwoPrimaryKeys,
      "function-Name"
    );

    const mockReq = ({
      headers: {
        "x-pagopa-lollipop-auth": invalidAuth
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(
          `Invalid or missing JWT in header ${aConfigWithTwoPrimaryKeys.BEARER_AUTH_HEADER}`
        )
      })
    });
  });

  it("\
    GIVEN a Valid jwtConfig and an x-pagopa-lollipop-auth valid ONLY for regex pattern\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a IResponseErrorForbiddenNotAuthorized containing Invalid or expired JWT\
    ", async () => {
    const invalidAuth = "Bearer aa";

    const middleware = verifyJWTMiddleware(
      aConfigWithTwoPrimaryKeys,
      "function-Name"
    );

    const mockReq = ({
      headers: {
        "x-pagopa-lollipop-auth": invalidAuth
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining("Invalid or expired JWT")
      })
    });
  });
});

// -------------------
// private methods
// -------------------

const checkDecodedToken = async (result: E.Either<Error, AuthJWT>) => {
  expect(result).toMatchObject(
    E.right(
      expect.objectContaining({
        ...aPayload,
        iss: issuer,
        iat: expect.any(Number),
        exp: expect.any(Number),
        jti: expect.any(String)
      })
    )
  );

  const decoded = (result as E.Right<jwt.JwtPayload>).right;
  expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toEqual(standardJWTTTL);
};
