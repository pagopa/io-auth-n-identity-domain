import { z } from "zod";

// Optional: when REDIS_HOST is unset no Redis client is created.
export const RedisConfigSchema = z.object({
  REDIS_HOST: z.string().min(1).optional(),
  REDIS_PORT: z.coerce.number().int().positive().max(65535).optional(),
  REDIS_PASSWORD: z.string().min(1).optional(),
  REDIS_TLS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
