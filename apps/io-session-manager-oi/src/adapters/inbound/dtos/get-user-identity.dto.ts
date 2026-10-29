import { NonEmptyStringBrand } from "@pagopa/hexagonal-core";
import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { SpidLevelSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

// This is a temporary workaround to ensure that the branded types are included in the type system.
const _brands = [NonEmptyStringBrand];

export const GetUserIdentityOutputDTO = z
  .object({
    family_name: NonEmptyStringSchema,
    fiscal_code: FiscalCodeSchema,
    assertion_ref: LollipopAssertionRefSchema,
    name: NonEmptyStringSchema,
    date_of_birth: z.iso.date(),
    spid_email: EmailAddressSchema.optional(),
    spid_level: SpidLevelSchema,
    created_at: z.number(),
    token_remaining_ttl: z.number().int(),
    session_tracking_id: NonEmptyStringSchema,
  })
  .meta({
    id: "UserIdentityWithTtl",
    description:
      "Describes the user's identity while it's authenticated, along with the session TTL.",
  });
export type GetUserIdentityOutputDTO = z.infer<typeof GetUserIdentityOutputDTO>;
