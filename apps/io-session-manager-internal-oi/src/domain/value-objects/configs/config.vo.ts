import { z } from "zod";

export const ConfigSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;
