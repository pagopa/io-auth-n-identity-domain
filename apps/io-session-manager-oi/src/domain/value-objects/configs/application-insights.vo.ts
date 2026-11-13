import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";


/**
 * Application Insights configuration.
 *
 * Contains `APPLICATIONINSIGHTS_CONNECTION_STRING`, which is required by
 * `@pagopa/azure-tracing`.
 */
const ApplicationInsightsBaseConfigSchema = z.object({
  APPLICATIONINSIGHTS_CONNECTION_STRING: NonEmptyStringSchema,
});

/**
 * Extends `ApplicationInsightsBaseConfigSchema` by forcing
 * `APPLICATIONINSIGHTS_ENTRA_ID_AUTH_ENABLED` to the environment-variable
 * value `"true"`.
 * This is necessary in order to connect to Application Insights
 * through the safer Microsoft Entra ID rather than with the
 * connection string.
 */
export const ApplicationInsightsProductionConfigSchema =
  ApplicationInsightsBaseConfigSchema.extend({
    APPLICATIONINSIGHTS_ENTRA_ID_AUTH_ENABLED: z.literal("true"),
  });

export const ApplicationInsightsDevelopmentConfigSchema =
  ApplicationInsightsBaseConfigSchema;
