import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { z } from "zod";


import { getRandomBytesHex, toSha256 } from "../../../utils/hash.js";

// ------------------------------------------------------------------------------
// Plain Session Token Value Object
// ------------------------------------------------------------------------------

export declare const _plainSessionTokenBrand: unique symbol;

/**
 * Zod schema for a plain session token
 */
export const PlainSessionTokenSchema =
  NonEmptyStringSchema.brand<typeof _plainSessionTokenBrand>();

/**
 * A plain session token
 */
export type PlainSessionToken = z.infer<typeof PlainSessionTokenSchema>;

// ------------------------------------------------------------------------------
// Hashed Session Token Value Object
// ------------------------------------------------------------------------------

export declare const _hashedSessionTokenBrand: unique symbol;

/**
 * Zod schema for a hashed session token
 */
export const HashedSessionTokenSchema =
  NonEmptyStringSchema.brand<typeof _hashedSessionTokenBrand>();

/**
 * A hashed session token
 */
export type HashedSessionToken = z.infer<typeof HashedSessionTokenSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const newPlainSessionToken = async (): Promise<PlainSessionToken> => {
  const randomBytesValue = await getRandomBytesHex(32);

  return PlainSessionTokenSchema.parse(randomBytesValue);
};

export const toHashedSessionToken = (
  plainToken: PlainSessionToken,
): HashedSessionToken => HashedSessionTokenSchema.parse(toSha256(plainToken));
