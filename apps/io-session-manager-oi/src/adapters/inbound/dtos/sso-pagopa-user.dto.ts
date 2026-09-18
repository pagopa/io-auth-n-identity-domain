import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { z } from "zod";

extendZodWithOpenApi(z);

export const SsoPagoPaUserOutputDTO = z
  .object({
    name: NonEmptyStringSchema,
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
    spid_email: EmailAddressSchema.optional(),
    notice_email: EmailAddressSchema,
  })
  .meta({
    id: "PagoPaUser",
    description: "The user data returned to the PagoPA backend.",
  });
