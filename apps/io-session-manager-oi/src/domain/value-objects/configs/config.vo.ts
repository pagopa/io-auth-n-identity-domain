import { z } from "zod";

import {
  AuthEventServiceBusDevelopmentConfigSchema,
  AuthEventServiceBusProductionConfigSchema,
} from "./auth-event-service-bus.vo.js";
import { IoFastLoginConfigSchema } from "./fast-login.vo.js";
import {
  LockedProfilesDevelopmentConfigSchema,
  LockedProfilesProductionConfigSchema,
} from "./locked-profiles.vo.js";
import { LollipopConfigSchema } from "./lollipop.vo.js";
import { OneIdConfigSchema } from "./one-id.vo.js";
import { IoProfileConfigSchema } from "./profile.vo.js";
import {
  PushNotificationsQueueDevelopmentConfigSchema,
  PushNotificationsQueueProductionConfigSchema,
} from "./push-notification-queue.vo.js";
import {
  RedisDevelopmentConfigSchema,
  RedisProductionConfigSchema,
} from "./redis.vo.js";
import { ServerConfigSchema } from "./server.vo.js";
import { IoSmIntConfigSchema } from "./session-manager-internal.vo.js";
import {
  SessionCosmosDevelopmentConfigSchema,
  SessionCosmosProductionConfigSchema,
} from "./session.vo.js";
import { LoginConfigSchema } from "./login.vo.js";

/**
 * Fields shared by every runtime environment.
 * Individual environment schemas extend this with their own discriminator + extras.
 */
const CommonConfigShape = {
  ...ServerConfigSchema.shape,
  ...LollipopConfigSchema.shape,
  ...IoProfileConfigSchema.shape,
  ...IoFastLoginConfigSchema.shape,
  ...IoSmIntConfigSchema.shape,
  ...OneIdConfigSchema.shape,
  ...LoginConfigSchema.shape,
};

/**
 * Production configuration schema.
 * Used when NODE_ENV is "production".
 */
export const ProductionConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("production"),
  ...LockedProfilesProductionConfigSchema.shape,
  ...PushNotificationsQueueProductionConfigSchema.shape,
  ...RedisProductionConfigSchema.shape,
  ...SessionCosmosProductionConfigSchema.shape,
  ...AuthEventServiceBusProductionConfigSchema.shape,
});

export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;

/**
 * Development configuration schema.
 * Used when NODE_ENV is "development".
 */
export const DevelopmentConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("development"),
  ...LockedProfilesDevelopmentConfigSchema.shape,
  ...PushNotificationsQueueDevelopmentConfigSchema.shape,
  ...RedisDevelopmentConfigSchema.shape,
  ...SessionCosmosDevelopmentConfigSchema.shape,
  ...AuthEventServiceBusDevelopmentConfigSchema.shape,
});

export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

/**
 * Application configuration schema.
 *
 * Smart parsing: the actual shape is a discriminated union on `NODE_ENV`.
 *
 * `NODE_ENV` MUST be set explicitly — the loader fails fast with a clear
 * `Invalid discriminator value` error otherwise.
 */
export const ConfigSchema = z.discriminatedUnion("NODE_ENV", [
  DevelopmentConfigSchema,
  ProductionConfigSchema,
]);

export type Config = z.infer<typeof ConfigSchema>;
