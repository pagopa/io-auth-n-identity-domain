import { z } from "zod";

export const ServerConfigSchema = z.object({
  HOST: z.union([z.ipv4(), z.ipv6(), z.literal("localhost")]),
  PORT: z.coerce.number().int().positive().max(65535),
  NODE_ENV: z.enum(["development", "production"]),
});