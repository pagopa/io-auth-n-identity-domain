import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

extendZodWithOpenApi(z);

export const SsoBpdUserInputDTO = {
  headers: z.object({
    authorization: z
      .string()
      .optional()   // Optional because the header may be missing, in which case the use case will return an AuthenticationError.
      .meta({
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
