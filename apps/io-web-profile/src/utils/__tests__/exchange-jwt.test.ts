import * as E from "fp-ts/Either";
import * as jwt from "jsonwebtoken";

import {
  ExchangeJWT,
  getGenerateExchangeJWT
} from "../exchange-jwt";
import { config as mockedConfig } from "../../__mocks__/config.mock";
import { TokenTypes } from "../enums/TokenTypes";
import { ExchangeJwtPayloadExtended } from "../middlewares/exchange-jwt-validation-middleware";

const aPayload = {
  family_name: "fn",
  fiscal_number: "fc",
  name: "name",
  token_type: TokenTypes.EXCHANGE
} as ExchangeJWT;

const expectedPayload = {
  ...aPayload,
  iss: mockedConfig.EXCHANGE_JWT_ISSUER
};

describe("getGenerateJWT", () => {
  it("should generate a valid ExchangeJWT", async () => {
    const generateJWT = getGenerateExchangeJWT(mockedConfig);

    const res = await generateJWT(aPayload)();

    expect(E.isRight(res)).toBeTruthy();
    if (E.isRight(res)) {
      const decodedToken = jwt.decode(res.right) as ExchangeJwtPayloadExtended;

      if (!decodedToken) {
        fail();
      }

      expect(decodedToken).toMatchObject(expectedPayload);
    }
  });
});
