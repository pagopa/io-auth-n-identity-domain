import { z } from "zod";

import { RedisConfigSchema } from "./redis.vo.js";
import { ServerConfigSchema } from "./server.vo.js";

const CommonConfigShape = {
  ...ServerConfigSchema.shape,
  ...RedisConfigSchema.shape,
};

export const ProductionConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("production"),
});

export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;

export const DevelopmentConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("development"),
});

export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

export const ConfigSchema = z.discriminatedUnion("NODE_ENV", [
  DevelopmentConfigSchema,
  ProductionConfigSchema,
]);

export type Config = z.infer<typeof ConfigSchema>;