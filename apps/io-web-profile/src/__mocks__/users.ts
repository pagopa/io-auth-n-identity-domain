import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { SpidLevel } from "../utils/enums/SpidLevels";
import { TokenTypes } from "../utils/enums/TokenTypes";
import { ExchangeJwtPayloadExtended } from "../utils/middlewares/exchange-jwt-validation-middleware";
import { HslJwtPayloadExtended } from "../utils/middlewares/hsl-jwt-validation-middleware";

export const aValidL2User: HslJwtPayloadExtended = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  spid_level: SpidLevel.L2,
  jti: "AAAA" as NonEmptyString,
  iat: 123456789
};

export const aValidExchangeUser: ExchangeJwtPayloadExtended = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  token_type: TokenTypes.EXCHANGE,
  jti: "AAAA" as NonEmptyString,
  iat: 123456789
};
