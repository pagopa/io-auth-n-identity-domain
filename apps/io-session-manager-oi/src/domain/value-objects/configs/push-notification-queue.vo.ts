import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

const PushNotificationQueueBaseConfigSchema = z.object({
  PUSH_NOTIFICATIONS_QUEUE_NAME: NonEmptyStringSchema,
});

export const PushNotificationsQueueProductionConfigSchema =
  PushNotificationQueueBaseConfigSchema.extend({
    PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI: z.url(),
  });

export const PushNotificationsQueueDevelopmentConfigSchema =
  PushNotificationQueueBaseConfigSchema.extend({
    PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING: NonEmptyStringSchema,
  });
