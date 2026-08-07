import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * Request schema for the OIDC callback endpoint.
 *
 * `code` and `state` are delivered by OneID as query-string parameters.
 */
export const CallbackInputDTO = {
  query: z.object({
    code: NonEmptyStringSchema,
    state: NonEmptyStringSchema,
  }),
};
