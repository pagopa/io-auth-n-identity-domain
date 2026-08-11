import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

const AuthEventServiceBusBaseConfigSchema = z.object({
  AUTH_SESSIONS_TOPIC_NAME: NonEmptyStringSchema,
});

export const AuthEventServiceBusProductionConfigSchema =
  AuthEventServiceBusBaseConfigSchema.extend({
    SERVICE_BUS_HOSTNAME: NonEmptyStringSchema,
  });

export const AuthEventServiceBusDevelopmentConfigSchema =
  AuthEventServiceBusBaseConfigSchema.extend({
    SERVICE_BUS_CONNECTION_STRING: NonEmptyStringSchema,
  });
