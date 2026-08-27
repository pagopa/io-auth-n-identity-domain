import { z } from "zod";
import { Sha256HexStringSchema, toSha256 } from "../../../utils/hash.js";
import { PlainSessionToken } from "./session-token.vo.js";

// ------------------------------------------------------------------------------
// Plain Zendesk SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainZendeskSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainZendeskSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _plainZendeskSSOTokenBrand>();

export type PlainZendeskSSOToken = z.infer<typeof PlainZendeskSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed Zendesk SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedZendeskSSOTokenBrand: unique symbol;

export const HashedZendeskSSOTokenSchema =
  Sha256HexStringSchema.brand<typeof _hashedZendeskSSOTokenBrand>();

export type HashedZendeskSSOToken = z.infer<typeof HashedZendeskSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const toPlainZendeskSSOToken = (
  token: PlainSessionToken,
): PlainZendeskSSOToken =>
  PlainZendeskSSOTokenSchema.parse(toSha256(`zendesk:${token}`));

export const toHashedZendeskSSOToken = (
  plainToken: PlainZendeskSSOToken,
): HashedZendeskSSOToken =>
  HashedZendeskSSOTokenSchema.parse(toSha256(plainToken));
