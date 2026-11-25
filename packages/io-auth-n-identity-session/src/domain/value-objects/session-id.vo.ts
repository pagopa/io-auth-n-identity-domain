import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { getRandomBytesHex } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";


export declare const _sessionIdBrand: unique symbol;

/**
 * Zod schema for a session ID
 * It represents a unique identifier for the user session
 */
export const SessionIdSchema =
  NonEmptyStringSchema.brand<typeof _sessionIdBrand>();

export type SessionId = z.infer<typeof SessionIdSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const newSessionId = async (): Promise<SessionId> => {
  const randomBytesValue = await getRandomBytesHex(32);

  return SessionIdSchema.parse(randomBytesValue);
};
