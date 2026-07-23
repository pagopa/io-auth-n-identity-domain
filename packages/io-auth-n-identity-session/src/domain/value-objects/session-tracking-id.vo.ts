import { z } from "zod";

export declare const _sessionTrackingIdBrand: unique symbol;

/**
 * Zod schema for a session tracking ID
 * It represents a unique identifier for the user session, ensuring that it is a valid UUID.
 */
export const SessionTrackingIdSchema = z
  .uuid("SessionTrackingId must be a valid UUID")
  .brand<typeof _sessionTrackingIdBrand>();

export type SessionTrackingId = z.infer<typeof SessionTrackingIdSchema>;
