import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * Request schema for the OIDC callback endpoint.
 *
 * `code` and `state` are delivered by OneID as query-string parameters. The
 * optional `x-forwarded-for` header carries the originating client IP when the
 * app runs behind the ingress proxy.
 */
export const CallbackInputDTO = {
  query: z.object({
    code: NonEmptyStringSchema,
    state: NonEmptyStringSchema,
  }),
};
