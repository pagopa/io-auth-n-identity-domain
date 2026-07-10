import { z } from "zod";

import { toSha256 } from "../../../utils/hash.js";
import { SessionTrackingIdSchema } from "../session-tracking-id.vo.js";

import { PlainSessionToken } from "./session-token.vo.js";

// ------------------------------------------------------------------------------
// Plain Zendesk SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainZendeskSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainZendeskSSOTokenSchema = z
  .string()
  .min(1)
  .brand<typeof _plainZendeskSSOTokenBrand>();

export type PlainZendeskSSOToken = z.infer<typeof PlainZendeskSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed Zendesk SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedZendeskSSOTokenBrand: unique symbol;

export const HashedZendeskSSOTokenSchema = z
  .string()
  .min(1)
  .brand<typeof _hashedZendeskSSOTokenBrand>();

export type HashedZendeskSSOToken = z.infer<typeof HashedZendeskSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed Zendesk SSO Token With Session Tracking ID Value Object
// ------------------------------------------------------------------------------

export const HashedZendeskSSOTokenWithSessionTrackingIdSchema = z.object({
  sessionTrackingId: SessionTrackingIdSchema,
  hashedToken: HashedZendeskSSOTokenSchema,
});

export type HashedZendeskSSOTokenWithSessionTrackingId = z.infer<
  typeof HashedZendeskSSOTokenWithSessionTrackingIdSchema
>;

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
