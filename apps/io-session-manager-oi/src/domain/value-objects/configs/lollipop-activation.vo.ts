import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";
import {
  CosmosDevelopmentConfigSchema,
  CosmosProductionConfigSchema,
} from "./cosmos.vo.js";

/**
 * Lollipop Activation Cosmos DB configuration schema.
 * Consists of the database name and the container names used by the
 * LollipopActivationCosmosAdapter to store lollipop activation records.
 */

const LollipopActivationCosmosBaseConfigSchema = z.object({
  COSMOSDB_LOLLIPOP_ACTIVATION_CONTAINER_NAME: NonEmptyStringSchema,
});

export const LollipopActivationCosmosProductionConfigSchema =
  CosmosProductionConfigSchema.extend(
    LollipopActivationCosmosBaseConfigSchema.shape,
  );

export const LollipopActivationCosmosDevelopmentConfigSchema =
  CosmosDevelopmentConfigSchema.extend(
    LollipopActivationCosmosBaseConfigSchema.shape,
  );
