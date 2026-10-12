import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * Request schema for the OIDC callback endpoint.
 *
 * A route request schema must be a single object, so success and error
 * responses share one shape: `state` is always present, `code` is delivered on
 * success and `error`/`error_description` on failure. The success/error
 * discrimination (on the presence of `code`) is enforced by the use case.
 *
 * NOTE: z.union is not allowed for DTOs right now
 */
export const CallbackInputDTO = {
  query: z.object({
    state: NonEmptyStringSchema.meta({
      description:
        "The opaque value used to maintain state between the request and the callback.",
    }),
    code: NonEmptyStringSchema.optional().meta({
      description:
        "The authorization code returned by the identity provider on success.",
    }),
    error: NonEmptyStringSchema.optional().meta({
      description:
        "The error code returned by the identity provider on failure.",
    }),
    error_description: NonEmptyStringSchema.optional().meta({
      description:
        "The human-readable error description returned by the identity provider on failure.",
    }),
  }),
};
