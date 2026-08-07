import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod"; /**

 * Session Cosmos DB configuration schema.
 * Consists of the database name and the container names used by the
 * SessionCosmosAdapter to store session tokens and active sessions.
 */

const SessionCosmosBaseConfigSchema = z.object({
  COSMOSDB_NAME: NonEmptyStringSchema,
  COSMOSDB_SESSION_TOKEN_CONTAINER_NAME: NonEmptyStringSchema,
  COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME: NonEmptyStringSchema,
});

export const SessionCosmosProductionConfigSchema =
  SessionCosmosBaseConfigSchema.extend({
    COSMOSDB_URI: z.url(),
  });

export const SessionCosmosDevelopmentConfigSchema =
  SessionCosmosBaseConfigSchema.extend({
    COSMOSDB_CONNECTION_STRING: NonEmptyStringSchema,
  });
