import { z } from "zod";

import { Sha256HexStringSchema, toSha256 } from "../../../utils/hash.js";

import { PlainSessionToken } from "./session-token.vo.js";

// ------------------------------------------------------------------------------
// Plain PagoPA SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainPagoPaSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainPagoPaSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _plainPagoPaSSOTokenBrand>();

export type PlainPagoPaSSOToken = z.infer<typeof PlainPagoPaSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed PagoPA SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedPagoPaSSOTokenBrand: unique symbol;

export const HashedPagoPaSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _hashedPagoPaSSOTokenBrand>();

export type HashedPagoPaSSOToken = z.infer<typeof HashedPagoPaSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const toPlainPagoPaSSOToken = (
  token: PlainSessionToken,
): PlainPagoPaSSOToken =>
  PlainPagoPaSSOTokenSchema.parse(toSha256(`pagopa:${token}`));

export const toHashedPagoPaSSOToken = (
  plainToken: PlainPagoPaSSOToken,
): HashedPagoPaSSOToken =>
  HashedPagoPaSSOTokenSchema.parse(toSha256(plainToken));
