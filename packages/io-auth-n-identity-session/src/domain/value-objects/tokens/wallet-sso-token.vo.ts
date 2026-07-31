import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { z } from "zod";


import { toSha256 } from "../../../utils/hash.js";

import { PlainSessionToken } from "./session-token.vo.js";

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
