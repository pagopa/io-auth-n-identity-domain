import { EmailAddressSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import {
  IsEmailValidatedSchema,
  IsTestProfileSchema,
} from "../value-objects/profile/profile.vo.js";

const NewProfileBase = z.object({
  is_email_validated: IsEmailValidatedSchema,
});

export const NewProfile = NewProfileBase.extend({
  email: EmailAddressSchema.optional(),
  is_test_profile: IsTestProfileSchema.optional(),
});
export type NewProfile = z.infer<typeof NewProfile>;
