import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { z } from "zod";


import { getRandomBytesHex, toSha256 } from "../../../utils/hash.js";
import { SessionTrackingIdSchema } from "../session-tracking-id.vo.js";

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

/**
 * Zod schema for a plain session token with tracking ID
 * It represents a unique identifier for the user session
 */
export const PlainSessionTokenWithTrackingIdSchema = z.object({
  sessionTrackingId: SessionTrackingIdSchema,
  plainSessionToken: PlainSessionTokenSchema,
});

/**
 * A plain session token with tracking ID
 * It represents a unique identifier for the user session
 */
export type PlainSessionTokenWithTrackingId = z.infer<
  typeof PlainSessionTokenWithTrackingIdSchema
>;

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

/**
 * Zod schema for a hashed session token with tracking ID
 * It represents a unique identifier for the user session
 */
export const HashedSessionTokenWithTrackingIdSchema = z.object({
  sessionTrackingId: SessionTrackingIdSchema,
  hashedSessionToken: HashedSessionTokenSchema,
});

/**
 * A hashed session token with tracking ID
 * It represents a unique identifier for the user session
 */
export type HashedSessionTokenWithTrackingId = z.infer<
  typeof HashedSessionTokenWithTrackingIdSchema
>;

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
