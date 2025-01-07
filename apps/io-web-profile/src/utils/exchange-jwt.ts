import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";

import { getGenerateJWT } from "@pagopa/ts-commons/lib/jwt_with_key_rotation";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import { enumType } from "@pagopa/ts-commons/lib/types";

import { JWTConfig } from "./config";
import { TokenTypes } from "./enums/TokenTypes";

export type MagicLinkPayload = t.TypeOf<typeof MagicLinkPayload>;
export const MagicLinkPayload = t.strict({
  family_name: NonEmptyString,
  fiscal_number: FiscalCode,
  iat: t.number,
  jti: NonEmptyString,
  name: NonEmptyString
});

export type ExchangeJWT = t.TypeOf<typeof ExchangeJWT>;
export const ExchangeJWT = t.strict({
  family_name: NonEmptyString,
  fiscal_number: FiscalCode,
  name: NonEmptyString,
  token_type: enumType(TokenTypes, "tokenType")
});

export type GenerateExchangeJWT = (
  exchangeJwt: ExchangeJWT
) => TE.TaskEither<Error, NonEmptyString>;

export const getGenerateExchangeJWT = ({
  EXCHANGE_JWT_ISSUER,
  EXCHANGE_JWT_TTL,
  EXCHANGE_JWT_PRIMARY_PRIVATE_KEY
}: JWTConfig): GenerateExchangeJWT =>
  pipe(
    getGenerateJWT(EXCHANGE_JWT_ISSUER, EXCHANGE_JWT_PRIMARY_PRIVATE_KEY),
    generateJWTFunction => (exchangeJWT): ReturnType<GenerateExchangeJWT> =>
      generateJWTFunction(exchangeJWT, EXCHANGE_JWT_TTL as Second)
  );
