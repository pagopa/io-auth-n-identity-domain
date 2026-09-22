import { z } from "zod";

import { Sha256HexStringSchema, toSha256 } from "../../../utils/hash.js";

import { PlainSessionToken } from "./session-token.vo.js";

// ------------------------------------------------------------------------------
// Plain PagoPA SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainPagopaSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainPagopaSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _plainPagopaSSOTokenBrand>();

export type PlainPagopaSSOToken = z.infer<typeof PlainPagopaSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed PagoPA SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedPagopaSSOTokenBrand: unique symbol;

export const HashedPagopaSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _hashedPagopaSSOTokenBrand>();

export type HashedPagopaSSOToken = z.infer<typeof HashedPagopaSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const toPlainPagopaSSOToken = (
  token: PlainSessionToken,
): PlainPagopaSSOToken =>
  PlainPagopaSSOTokenSchema.parse(toSha256(`pagopa:${token}`));

export const toHashedPagopaSSOToken = (
  plainToken: PlainPagopaSSOToken,
): HashedPagopaSSOToken =>
  HashedPagopaSSOTokenSchema.parse(toSha256(plainToken));
