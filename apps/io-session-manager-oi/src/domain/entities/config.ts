import { z } from "zod";

const ServerConfigSchema = z.object({
  HOST: z.union([z.ipv4(), z.ipv6(), z.literal("localhost")]),
  PORT: z.coerce.number().int().positive().max(65535),
});

const LollipopConfigSchema = z.object({
  LOLLIPOP_API_URL: z.url(),
  LOLLIPOP_API_BASE_PATH: z.string().min(1),
  LOLLIPOP_API_KEY: z.string().min(1),
});

export const ConfigSchema = z.object({
  ...ServerConfigSchema.shape,
  ...LollipopConfigSchema.shape,
});

export type Config = z.infer<typeof ConfigSchema>;
