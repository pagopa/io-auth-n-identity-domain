import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * Domain-specific Cosmos DB configuration schema.
 */

const CosmosBaseConfigSchema = z.object({
  COSMOSDB_NAME: NonEmptyStringSchema,
});

export const CosmosProductionConfigSchema = CosmosBaseConfigSchema.extend({
  COSMOSDB_URI: z.url(),
});

export const CosmosDevelopmentConfigSchema = CosmosBaseConfigSchema.extend({
  COSMOSDB_CONNECTION_STRING: NonEmptyStringSchema,
});
