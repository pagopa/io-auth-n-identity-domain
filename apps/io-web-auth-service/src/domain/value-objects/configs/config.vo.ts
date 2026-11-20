import { z } from "zod";

import { OneIdConfigSchema } from "./one-id.vo.js";
import {
  RedisDevelopmentConfigSchema,
  RedisProductionConfigSchema,
} from "./redis.vo.js";
import { ServerConfigSchema } from "./server.vo.js";

const CommonConfigShape = {
  ...ServerConfigSchema.shape,
  ...OneIdConfigSchema.shape,
};

export const ProductionConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("production"),
  ...RedisProductionConfigSchema.shape,
});

export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;

export const DevelopmentConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("development"),
  ...RedisDevelopmentConfigSchema.shape,
});

export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

export const ConfigSchema = z.discriminatedUnion("NODE_ENV", [
  DevelopmentConfigSchema,
  ProductionConfigSchema,
]);

export type Config = z.infer<typeof ConfigSchema>;
