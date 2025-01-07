import * as express from "express";
import * as E from "fp-ts/Either";
import * as jwt from "jsonwebtoken";

import { IResponseErrorForbiddenNotAuthorized } from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { config as mockedConfig } from "../../../__mocks__/config.mock";

import { Second } from "@pagopa/ts-commons/lib/units";
import { TokenTypes } from "../../enums/TokenTypes";
import { ExchangeJWT, getGenerateExchangeJWT } from "../../exchange-jwt";
import {
  ExchangeJwtPayloadExtended,
  exchangeJwtValidation,
  exchangeJwtValidationMiddleware
} from "../exchange-jwt-validation-middleware";

const standardJWTTTL = mockedConfig.EXCHANGE_JWT_TTL as Second;
const issuer = mockedConfig.EXCHANGE_JWT_ISSUER;

const aPayload: ExchangeJWT = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  token_type: TokenTypes.EXCHANGE,
};

describe("exchangeJwtValidation - Success", () => {
  it("should succeed validating a valid JWT", async () => {
    // Setup
    const generateJWT = getGenerateExchangeJWT(mockedConfig);
    const token = await generateJWT(aPayload)();

    expect(E.isRight(token)).toBeTruthy();
    if (E.isRight(token)) {
      // Test
      const result = await exchangeJwtValidation(mockedConfig)(token.right)();
      checkDecodedToken(result);
    }
  });
});

describe("ExchangeJWTValidationMiddleware", () => {
  it("\
      GIVEN a Valid jwtConfig and a valid authorization\
      WHEN ExchangeJwtValidationMiddleware is called\
      THEN it should return a valid ExchangeJWT\
      ", async () => {
    const exchangeJwt = await getGenerateExchangeJWT(mockedConfig)(aPayload)();
    expect(E.isRight(exchangeJwt)).toBeTruthy();

    const middleware = exchangeJwtValidationMiddleware(mockedConfig);

    if (E.isRight(exchangeJwt)) {
      const mockReq = ({
        headers: {
          authorization: `Bearer ${exchangeJwt.right}`
        }
      } as unknown) as express.Request;

      await expect(middleware(mockReq)).resolves.toMatchObject({
        _tag: "Right",
        right: expect.objectContaining({
          family_name: aPayload.family_name,
          fiscal_number: aPayload.fiscal_number,
          name: aPayload.name,
          token_type: aPayload.token_type,
          iss: issuer
        })
      });
    }
  });

  it("\
      GIVEN a Valid jwtConfig and an empty authorization\
      WHEN ExchangeJwtValidationMiddleware is called\
      THEN it should return a IResponseErrorForbiddenNotAuthorized\
      ", async () => {
    const middleware = exchangeJwtValidationMiddleware(mockedConfig);

    const mockReq = ({
      headers: {
        authorization: ""
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(
          `Invalid or missing JWT in header ${mockedConfig.BEARER_AUTH_HEADER}`
        )
      })
    });
  });

  it("\
      GIVEN a Valid jwtConfig and an invalid authorization\
      WHEN ExchangeJWTValidationMiddleware is called\
      THEN it should return a IResponseErrorForbiddenNotAuthorized\
      ", async () => {
    const invalidAuth = "invalidAuth";

    const middleware = exchangeJwtValidationMiddleware(mockedConfig);

    const mockReq = ({
      headers: {
        authorization: invalidAuth
      }
    } as unknown) as express.Request;

    await expect(middleware(mockReq)).resolves.toMatchObject({
      _tag: "Left",
      left: expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized",
        detail: expect.stringContaining(
          `Invalid or missing JWT in header ${mockedConfig.BEARER_AUTH_HEADER}`
        )
      })
    });
  });
});

// -------------------
// private methods
// -------------------

const checkDecodedToken = async (
  result: E.Either<IResponseErrorForbiddenNotAuthorized, jwt.JwtPayload>
) => {
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
