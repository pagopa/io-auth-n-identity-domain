import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const RedisProductionConfigSchema = z.object({
  REDIS_HOSTNAME: NonEmptyStringSchema,
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  REDIS_TLS_ENABLED: z.stringbool().default(true),
});

export const RedisDevelopmentConfigSchema = RedisProductionConfigSchema.extend({
  REDIS_PASSWORD: NonEmptyStringSchema.optional(),
});
