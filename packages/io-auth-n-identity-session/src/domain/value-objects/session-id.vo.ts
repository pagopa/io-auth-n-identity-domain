import { NonEmptyStringSchema } from "@pagopa/hexagonal-core/domain/value-objects";
import { z } from "zod";

export declare const _sessionIdBrand: unique symbol;

/**
 * Zod schema for a session ID
 * It represents a unique identifier for the user session
 */
export const SessionIdSchema =
  NonEmptyStringSchema.brand<typeof _sessionIdBrand>();

export type SessionId = z.infer<typeof SessionIdSchema>;
