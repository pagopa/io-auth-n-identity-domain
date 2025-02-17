import { Database } from "@azure/cosmos";

export type CosmosDBDependency = {
  readonly db: Database;
};
