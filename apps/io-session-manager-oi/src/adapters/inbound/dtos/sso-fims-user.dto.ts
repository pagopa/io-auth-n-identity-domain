import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  NonEmptyStringSchema,
  FiscalCodeSchema,
  EmailAddressSchema,
} from "@pagopa/hexagonal-core";
import { SpidLevelSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

extendZodWithOpenApi(z);

export const FimsUserSchema = z
  .object({
    name: NonEmptyStringSchema,
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
    auth_time: z.number().int().min(0),
    acr: SpidLevelSchema,
    email: EmailAddressSchema,
    date_of_birth: z.iso.date(),
  })
  .meta({
    id: "FIMSUser",
    description: "The user data returned to the FIMS backend.",
  });

export const SsoFimsUserOutputDTO = FimsUserSchema;
