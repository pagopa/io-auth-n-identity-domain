import { z } from "zod";

import { SessionTrackingIdSchema } from "../session-tracking-id.vo.js";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { PlainSessionToken } from "./session-token.vo.js";
import { toSha256 } from "../../../utils/hash.js";

// ------------------------------------------------------------------------------
// Plain Wallet SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainWalletSSOTokenBrand: unique symbol;

// Zod schemas with string literal brands
export const PlainWalletSSOTokenSchema =
  NonEmptyStringSchema.brand<typeof _plainWalletSSOTokenBrand>();

export type PlainWalletSSOToken = z.infer<typeof PlainWalletSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed Wallet SSO Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedWalletSSOTokenBrand: unique symbol;

export const HashedWalletSSOTokenSchema =
  NonEmptyStringSchema.brand<typeof _hashedWalletSSOTokenBrand>();

export type HashedWalletSSOToken = z.infer<typeof HashedWalletSSOTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed Wallet SSO Token With Session Tracking ID Value Object
// ------------------------------------------------------------------------------

export const HashedWalletSSOTokenWithSessionTrackingIdSchema = z.object({
  sessionTrackingId: SessionTrackingIdSchema,
  hashedToken: HashedWalletSSOTokenSchema,
});

export type HashedWalletSSOTokenWithSessionTrackingId = z.infer<
  typeof HashedWalletSSOTokenWithSessionTrackingIdSchema
>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const toPlainWalletSSOToken = (
  token: PlainSessionToken,
): PlainWalletSSOToken =>
  PlainWalletSSOTokenSchema.parse(toSha256(`wallet:${token}`));

export const toHashedWalletSSOToken = (
  plainToken: PlainWalletSSOToken,
): HashedWalletSSOToken =>
  HashedWalletSSOTokenSchema.parse(toSha256(plainToken));
