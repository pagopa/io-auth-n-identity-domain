import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { PlainBpdSSOTokenSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

import { createBearerTokenSchema } from "../bearer-token.js";

extendZodWithOpenApi(z);

const BearerBpdTokenSchema = createBearerTokenSchema(PlainBpdSSOTokenSchema);

export const SsoBpdUserInputDTO = {
  headers: z.object({
    authorization: BearerBpdTokenSchema,
  }),
};

export type SsoBpdUserInputDTO = z.infer<typeof SsoBpdUserInputDTO>;

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
