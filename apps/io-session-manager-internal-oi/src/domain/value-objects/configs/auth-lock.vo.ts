import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

const AuthLockBaseConfigSchema = z.object({
  LOCKED_PROFILES_TABLE_NAME: NonEmptyStringSchema,
});

export const AuthLockProductionConfigSchema =
  AuthLockBaseConfigSchema.extend({
    LOCKED_PROFILES_STORAGE_ACCOUNT_URI: z.url(),
  });

export const AuthLockDevelopmentConfigSchema =
  AuthLockBaseConfigSchema.extend({
    LOCKED_PROFILES_STORAGE_CONNECTION_STRING: NonEmptyStringSchema,
  });
