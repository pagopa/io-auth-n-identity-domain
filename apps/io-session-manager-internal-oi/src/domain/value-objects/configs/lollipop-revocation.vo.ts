import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

const LollipopRevocationQueueBaseConfigSchema = z.object({
  LOLLIPOP_REVOCATION_QUEUE_NAME: NonEmptyStringSchema,
});

export const LollipopRevocationQueueProductionConfigSchema =
  LollipopRevocationQueueBaseConfigSchema.extend({
    LOLLIPOP_REVOCATION_QUEUE_STORAGE_URI: z.url(),
  });

export const LollipopRevocationQueueDevelopmentConfigSchema =
  LollipopRevocationQueueBaseConfigSchema.extend({
    LOLLIPOP_REVOCATION_QUEUE_STORAGE_CONNECTION_STRING: NonEmptyStringSchema,
  });
