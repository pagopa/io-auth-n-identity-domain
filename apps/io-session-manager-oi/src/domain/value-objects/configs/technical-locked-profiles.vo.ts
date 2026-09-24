import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

const TechnicalLockedProfilesBaseConfigSchema = z.object({
  TECHNICAL_LOCKED_PROFILES_TABLE_NAME: NonEmptyStringSchema,
});

export const TechnicalLockedProfilesProductionConfigSchema =
  TechnicalLockedProfilesBaseConfigSchema.extend({
    TECHNICAL_LOCKED_PROFILES_STORAGE_ACCOUNT_URI: z.url(),
  });

export const TechnicalLockedProfilesDevelopmentConfigSchema =
  TechnicalLockedProfilesBaseConfigSchema.extend({
    TECHNICAL_LOCKED_PROFILES_STORAGE_CONNECTION_STRING: NonEmptyStringSchema,
  });
