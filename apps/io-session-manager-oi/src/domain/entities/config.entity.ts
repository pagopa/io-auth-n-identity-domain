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

export type LollipopConfig = z.infer<typeof LollipopConfigSchema>;

/**
 * Application configuration schema.
 * Combines all schemas into a single schema for the entire application configuration.
 */
export const ConfigSchema = z.object({
  ...ServerConfigSchema.shape,
  ...LollipopConfigSchema.shape,
});

export type Config = z.infer<typeof ConfigSchema>;
