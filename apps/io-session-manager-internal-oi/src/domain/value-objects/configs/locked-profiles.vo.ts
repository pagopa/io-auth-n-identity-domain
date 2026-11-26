import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

const LockedProfilesBaseConfigSchema = z.object({
  LOCKED_PROFILES_TABLE_NAME: NonEmptyStringSchema,
});

export const LockedProfilesProductionConfigSchema =
  LockedProfilesBaseConfigSchema.extend({
    LOCKED_PROFILES_STORAGE_ACCOUNT_URI: z.url(),
  });

export const LockedProfilesDevelopmentConfigSchema =
  LockedProfilesBaseConfigSchema.extend({
    LOCKED_PROFILES_STORAGE_CONNECTION_STRING: NonEmptyStringSchema,
  });
