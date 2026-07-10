import { z } from "zod";

import { SessionTrackingIdSchema } from "../session-tracking-id.vo.js";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { PlainSessionToken } from "./session-token.vo.js";
import { toSha256 } from "../../../utils/hash.js";

// ------------------------------------------------------------------------------
// Plain FIMS SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainFimsSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainFimsSSOTokenSchema =
  NonEmptyStringSchema.brand<typeof _plainFimsSSOTokenBrand>();

export type PlainFimsSSOToken = z.infer<typeof PlainFimsSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed FIMS SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedFimsSSOTokenBrand: unique symbol;

export const HashedFimsSSOTokenSchema =
  NonEmptyStringSchema.brand<typeof _hashedFimsSSOTokenBrand>();

export type HashedFimsSSOToken = z.infer<typeof HashedFimsSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed FIMS SSO Token With Session Tracking ID Value Object
// ------------------------------------------------------------------------------

export const HashedFimsSSOTokenWithSessionTrackingIdSchema = z.object({
  sessionTrackingId: SessionTrackingIdSchema,
  hashedToken: HashedFimsSSOTokenSchema,
});

export type HashedFimsSSOTokenWithSessionTrackingId = z.infer<
  typeof HashedFimsSSOTokenWithSessionTrackingIdSchema
>;

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
