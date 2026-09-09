import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod"; /**

 * Session Cosmos DB configuration schema.
 * Consists of the database name and the container names used by the
 * SessionCosmosAdapter to store session tokens and active sessions.
 */
import {
  CosmosDevelopmentConfigSchema,
  CosmosProductionConfigSchema,
} from "./cosmos.vo.js";

const SessionCosmosBaseConfigSchema = z.object({
  COSMOSDB_SESSION_TOKEN_CONTAINER_NAME: NonEmptyStringSchema,
  COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME: NonEmptyStringSchema,
});

export const SessionCosmosProductionConfigSchema =
  CosmosProductionConfigSchema.extend(SessionCosmosBaseConfigSchema.shape);

export const SessionCosmosDevelopmentConfigSchema =
  CosmosDevelopmentConfigSchema.extend(SessionCosmosBaseConfigSchema.shape);
