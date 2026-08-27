import { z } from "zod";
import { Sha256HexStringSchema, toSha256 } from "../../../utils/hash.js";
import { PlainSessionToken } from "./session-token.vo.js";

// ------------------------------------------------------------------------------
// Plain FIMS SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainFimsSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainFimsSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _plainFimsSSOTokenBrand>();

export type PlainFimsSSOToken = z.infer<typeof PlainFimsSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed FIMS SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedFimsSSOTokenBrand: unique symbol;

export const HashedFimsSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _hashedFimsSSOTokenBrand>();

export type HashedFimsSSOToken = z.infer<typeof HashedFimsSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const toPlainFimsSSOToken = (
  token: PlainSessionToken,
): PlainFimsSSOToken =>
  PlainFimsSSOTokenSchema.parse(toSha256(`fims:${token}`));

export const toHashedFimsSSOToken = (
  plainToken: PlainFimsSSOToken,
): HashedFimsSSOToken => HashedFimsSSOTokenSchema.parse(toSha256(plainToken));
