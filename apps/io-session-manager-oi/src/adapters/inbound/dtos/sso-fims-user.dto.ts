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

extendZodWithOpenApi(z);

export const SsoFimsUserOutputDTO = z
  .object({
    name: NonEmptyStringSchema,
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
    // `PositiveIntegerSchema` from `@pagopa/hexagonal-core` generates an OpenAPI spec which is not compatible with APIM.
    // It generates a `type: integer` with a `exclusiveMinimum` in the OpenAPI spec, which APIM does not accept.
    // Using z.int().min(1) instead of PositiveIntegerSchema to ensure compatibility with APIM.
    // This generates a `type: integer` with a `minimum: 1` in the OpenAPI spec instead.
    auth_time: z.int().min(1),
    acr: SpidLevelSchema,
    email: EmailAddressSchema.optional(),
    date_of_birth: z.iso.date(),
  })
  .meta({
    id: "FIMSUser",
    description: "The user data returned to the FIMS backend.",
  });
