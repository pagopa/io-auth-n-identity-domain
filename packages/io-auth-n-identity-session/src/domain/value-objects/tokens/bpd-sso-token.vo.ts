import { z } from "zod";

import { SessionTrackingIdSchema } from "../session-tracking-id.vo.js";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { PlainSessionToken } from "./session-token.vo.js";
import { toSha256 } from "../../../utils/hash.js";

// ------------------------------------------------------------------------------
// Plain BPD SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainBpdSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainBpdSSOTokenSchema =
  NonEmptyStringSchema.brand<typeof _plainBpdSSOTokenBrand>();

export type PlainBpdSSOToken = z.infer<typeof PlainBpdSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed BPD SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedBpdSSOTokenBrand: unique symbol;

export const HashedBpdSSOTokenSchema =
  NonEmptyStringSchema.brand<typeof _hashedBpdSSOTokenBrand>();

export type HashedBpdSSOToken = z.infer<typeof HashedBpdSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed BPD SSO Token With Session Tracking ID Value Object
// ------------------------------------------------------------------------------

export const HashedBpdSSOTokenWithSessionTrackingIdSchema = z.object({
  sessionTrackingId: SessionTrackingIdSchema,
  hashedToken: HashedBpdSSOTokenSchema,
});

export type HashedBpdSSOTokenWithSessionTrackingId = z.infer<
  typeof HashedBpdSSOTokenWithSessionTrackingIdSchema
>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const toPlainBpdSSOToken = (
  token: PlainSessionToken,
): PlainBpdSSOToken => PlainBpdSSOTokenSchema.parse(toSha256(`bpd:${token}`));

export const toHashedBpdSSOToken = (
  plainToken: PlainBpdSSOToken,
): HashedBpdSSOToken => HashedBpdSSOTokenSchema.parse(toSha256(plainToken));
