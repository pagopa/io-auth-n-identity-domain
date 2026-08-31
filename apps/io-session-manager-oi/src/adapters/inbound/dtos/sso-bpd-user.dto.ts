import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

extendZodWithOpenApi(z);

const BEARER_PREFIX = "Bearer ";

export const BearerAuthorizationHeaderSchema = z
  .string()
  .startsWith(
    BEARER_PREFIX,
    `Expected '${BEARER_PREFIX}<token>' authorization header`,
  );

export const SsoBpdUserInputDTO = {
  headers: z.object({
    authorization: BearerAuthorizationHeaderSchema.meta({
      description:
        "`Bearer <sessionId>.<plainBpdSSOToken>` authorization header.",
    }),
  }),
};

export const SsoBpdUserOutputDTO = z
  .object({
    name: NonEmptyStringSchema,
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
  })
  .meta({
    id: "BPDUser",
    description: "The user data returned to the BPD backend.",
  });
