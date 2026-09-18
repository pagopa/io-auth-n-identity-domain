import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { z } from "zod";

extendZodWithOpenApi(z);

export const SsoWalletUserOutputDTO = z
  .object({
    name: NonEmptyStringSchema,
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
    spid_email: EmailAddressSchema,
    notice_email: EmailAddressSchema,
  })
  .meta({
    id: "WalletUser",
    description: "The user data returned to the Wallet backend.",
  });
