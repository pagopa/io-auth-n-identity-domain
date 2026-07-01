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
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Lollipop configuration schema.
 * Consists of the URL, base path, and API key for the Lollipop service.
 */
export const LollipopConfigSchema = z.object({
  LOLLIPOP_API_URL: z.url(),
  LOLLIPOP_API_BASE_PATH: z.string().min(1),
  LOLLIPOP_API_KEY: z.string().min(1),
});
export type LollipopConfigSchema = z.infer<typeof LollipopConfigSchema>;

const AusiliarStorageConfigSchema = z.object({
  REDIS_URL: NonEmptyStringSchema,
  REDIS_PASSWORD: NonEmptyStringSchema,
  REDIS_PORT: z.coerce.number(),
});

const SessionStorageConfigSchema = z.object({
  SESSION_COSMOSDB_ENDPOINT: NonEmptyStringSchema,
  SESSION_COSMOSDB_KEY: NonEmptyStringSchema,
});

const OneIdConfigSchema = z
  .object({
    ONEID_PROD_CLIENT_ID: NonEmptyStringSchema,
    ONEID_PROD_CLIENT_SECRET: NonEmptyStringSchema,
    ONEID_PROD_ISSUER: NonEmptyStringSchema,
    ONEID_PROD_REDIRECT_URI: NonEmptyStringSchema,
  })
  .and(
    z
      .object({
        ONEID_UAT_CLIENT_ID: NonEmptyStringSchema,
        ONEID_UAT_CLIENT_SECRET: NonEmptyStringSchema,
        ONEID_UAT_ISSUER: NonEmptyStringSchema,
        ONEID_UAT_REDIRECT_URI: NonEmptyStringSchema,
      })
      .partial(),
  );

export const ConfigSchema = z.intersection(
  z.object({
    ...ServerConfigSchema.shape,
    ...LollipopConfigSchema.shape,
    ...AusiliarStorageConfigSchema.shape,
    ...SessionStorageConfigSchema.shape,
  }),
  OneIdConfigSchema,
);

export type Config = z.infer<typeof ConfigSchema>;
