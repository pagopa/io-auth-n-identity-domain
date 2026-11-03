import { EmailAddressSchema, FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const UserProfileSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  email: EmailAddressSchema.optional(),
  isEmailValidated: z.boolean(),
  isTestProfile: z.boolean().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
