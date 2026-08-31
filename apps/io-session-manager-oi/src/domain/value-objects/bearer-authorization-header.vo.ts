import { z } from "zod";

const BEARER_PREFIX = "Bearer ";

/**
 * `Authorization: Bearer <token>` header.
 * Parses to the enclosed token with the `Bearer ` prefix and strips it.
 * Ensures that the token is a non-empty string.
 */
export const BearerAuthorizationHeaderSchema = z
  .string()
  .startsWith(
    BEARER_PREFIX,
    `Expected '${BEARER_PREFIX}<token>' authorization header`,
  )
  .refine((raw) => raw.length > BEARER_PREFIX.length, {
    message: "Authorization header must contain a non-empty token",
  })
  .transform((raw) => raw.slice(BEARER_PREFIX.length));
