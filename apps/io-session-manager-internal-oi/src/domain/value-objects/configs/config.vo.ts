import { NonEmptyStringBrand } from "@pagopa/hexagonal-core";
import { z } from "zod";

import {
  AuthEventServiceBusProductionConfigSchema,
  AuthEventServiceBusDevelopmentConfigSchema,
} from "./auth-event-service-bus.vo.js";
import { CosmosProductionConfigSchema, CosmosDevelopmentConfigSchema } from "./cosmos.vo.js";
import { LollipopActivationCosmosProductionConfigSchema, LollipopActivationCosmosDevelopmentConfigSchema } from "./lollipop-activation.vo.js";
import { LollipopRevocationQueueProductionConfigSchema, LollipopRevocationQueueDevelopmentConfigSchema } from "./lollipop-revocation.vo.js";
import { PlatformProxyConfigSchema } from "./platform-proxy.vo.js";
import { ServerConfigSchema } from "./server.vo.js";
import { SessionCosmosProductionConfigSchema, SessionCosmosDevelopmentConfigSchema } from "./session.vo.js";
import {
  TechnicalLockedProfilesDevelopmentConfigSchema,
  TechnicalLockedProfilesProductionConfigSchema,
} from "./technical-locked-profiles.vo.js";
import {
  AuthLockDevelopmentConfigSchema,
  AuthLockProductionConfigSchema,
} from "./auth-lock.vo.js";

// This is a temporary workaround to ensure that the branded types are included in the type system.
const _brands = [NonEmptyStringBrand];

const CommonConfigShape = {
  ...PlatformProxyConfigSchema.shape,
  ...ServerConfigSchema.shape,
};

export const ProductionConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("production"),
  ...AuthEventServiceBusProductionConfigSchema.shape,
  ...CosmosProductionConfigSchema.shape,
  ...LollipopActivationCosmosProductionConfigSchema.shape,
  ...LollipopRevocationQueueProductionConfigSchema.shape,
  ...SessionCosmosProductionConfigSchema.shape,
  ...TechnicalLockedProfilesProductionConfigSchema.shape,
  ...AuthLockProductionConfigSchema.shape,
});

export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;

export const DevelopmentConfigSchema = z.object({
  ...CommonConfigShape,
  NODE_ENV: z.literal("development"),
  ...AuthEventServiceBusDevelopmentConfigSchema.shape,
  ...CosmosDevelopmentConfigSchema.shape,
  ...LollipopActivationCosmosDevelopmentConfigSchema.shape,
  ...LollipopRevocationQueueDevelopmentConfigSchema.shape,
  ...SessionCosmosDevelopmentConfigSchema.shape,
  ...TechnicalLockedProfilesDevelopmentConfigSchema.shape,
  ...AuthLockDevelopmentConfigSchema.shape,
});

export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

// NODE_ENV must be explicit so startup cannot select the wrong environment.
export const ConfigSchema = z.discriminatedUnion("NODE_ENV", [
  DevelopmentConfigSchema,
  ProductionConfigSchema,
]);

export type Config = z.infer<typeof ConfigSchema>;
