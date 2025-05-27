import { Database } from "@azure/cosmos";

export type CosmosDBDependency = {
  readonly cosmosApiDb: Database;
  readonly citizenAuthDb: Database;
};
