import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { BearerAuthorizationHeaderSchema } from "../../../domain/value-objects/bearer-authorization-header.vo.js";

extendZodWithOpenApi(z);

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
