import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const OidcEnvironmentSchema = z.enum(["UAT", "PROD"]).default("PROD");
export type OidcEnvironment = z.infer<typeof OidcEnvironmentSchema>;

// Decoded OIDC callback: `state` is always present; a present `code` marks a
// success response, otherwise it is a provider error response
// (`error`/`error_description`, RFC 6749 §4.1.2.1).
export const OidcCallbackSuccessParamsSchema = z.object({
  state: NonEmptyStringSchema,
  code: NonEmptyStringSchema,
});

export type OidcCallbackSuccessParams = z.infer<
  typeof OidcCallbackSuccessParamsSchema
>;

export const OidcCallbackErrorParamsSchema = z.object({
  state: NonEmptyStringSchema,
  error: NonEmptyStringSchema,
  error_description: NonEmptyStringSchema.optional(),
});

export type OidcCallbackErrorParams = z.infer<
  typeof OidcCallbackErrorParamsSchema
>;
