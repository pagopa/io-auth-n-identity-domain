import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * Server configuration schema.
 * Consists of the host and port on which the server will listen.
 * Needed to start the server. In case of missing or invalid configuration, the application will not start.
 */
export const ServerConfigSchema = z.object({
  HOST: z.union([z.ipv4(), z.ipv6(), z.literal("localhost")]),
  PORT: z.coerce.number().int().positive().max(65535),
  NODE_ENV: z.enum(["development", "production"]),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Lollipop configuration schema.
 * Consists of the URL, base path, and API key for the Lollipop service.
 */
export const LollipopConfigSchema = z.object({
  LOLLIPOP_API_URL: z.url(),
  LOLLIPOP_API_BASE_PATH: NonEmptyStringSchema,
  LOLLIPOP_API_KEY: NonEmptyStringSchema,
});

export type LollipopConfig = z.infer<typeof LollipopConfigSchema>;

/**
 * IO Profile configuration schema.
 * Consists of the URL, base path, and API key for the IO Profile service.
 */
export const IoProfileConfigSchema = z.object({
  IO_PROFILE_API_URL: z.url(),
  IO_PROFILE_API_BASE_PATH: NonEmptyStringSchema,
  IO_PROFILE_API_KEY: NonEmptyStringSchema,
});

export type IoProfileConfig = z.infer<typeof IoProfileConfigSchema>;

/**
 * Locked Profiles configuration schema.
 * Consists of the name of the Azure Table Storage table used to store locked profiles.
 */
export const LockedProfilesConfigSchema = z.object({
  LOCKED_PROFILES_TABLE_NAME: NonEmptyStringSchema,
});

export type LockedProfilesConfig = z.infer<typeof LockedProfilesConfigSchema>;

/**
 * Fields shared by every runtime environment.
 * Individual environment schemas extend this with their own discriminator + extras.
 */
const CommonConfigShape = {
  ...ServerConfigSchema.shape,
  ...LollipopConfigSchema.shape,
  ...IoProfileConfigSchema.shape,
  ...LockedProfilesConfigSchema.shape,
};

/**
 * Production configuration schema.
 * Used when NODE_ENV is "production".
 */
export const ProductionConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("production"),
  LOCKED_PROFILES_STORAGE_ACCOUNT_URI: z.url(),
});

export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;

/**
 * Development configuration schema.
 * Adds the connection string required to connect to the storage.
 */
export const DevelopmentConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("development"),
  LOCKED_PROFILES_TABLE_CONNECTION_STRING: NonEmptyStringSchema,
});

export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

/**
 * Application configuration schema.
 *
 * Smart parsing: the actual shape is a discriminated union on `NODE_ENV`.
 * When `NODE_ENV=development` the loader requires the development-only fields
 * (e.g. `LOCKED_PROFILES_TABLE_CONNECTION_STRING`); when `NODE_ENV=production`
 * it requires the production-only fields (e.g. `LOCKED_PROFILES_STORAGE_ACCOUNT_URI`).
 *
 * `NODE_ENV` MUST be set explicitly — the loader fails fast with a clear
 * `Invalid discriminator value` error otherwise.
 */
export const ConfigSchema = z.discriminatedUnion("NODE_ENV", [
  DevelopmentConfigSchema,
  ProductionConfigSchema,
]);

export type Config = z.infer<typeof ConfigSchema>;
