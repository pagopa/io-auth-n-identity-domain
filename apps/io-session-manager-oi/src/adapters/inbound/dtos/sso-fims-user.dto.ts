import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import {
  SpidLevelSchema,
} from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

import { PositiveIntegerSchema } from "../../../domain/value-objects/positive-integer.vo.js";

extendZodWithOpenApi(z);

export const SsoFimsUserOutputDTO = z
  .object({
    name: NonEmptyStringSchema,
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
    auth_time: PositiveIntegerSchema,
    acr: SpidLevelSchema,
    email: EmailAddressSchema.optional(),
    date_of_birth: z.iso.date(),
  })
  .meta({
    id: "FIMSUser",
    description: "The user data returned to the FIMS backend.",
  });
