import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { IPStringSchema } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

/**
 * Request schema for the OIDC callback endpoint.
 *
 * `code` and `state` are delivered by OneID as query-string parameters. The
 * optional `x-forwarded-for` header carries the originating client IP when the
 * app runs behind the ingress proxy.
 */
export const CallbackInputDTO = {
  headers: z.object({
    "x-forwarded-for": IPStringSchema.optional(),
  }),
  query: z.object({
    code: NonEmptyStringSchema,
    state: NonEmptyStringSchema,
  }),
};
