import * as TE from "fp-ts/lib/TaskEither";

import {
  Container,
  CosmosClient,
  Database,
  IndexingPolicy
} from "@azure/cosmos";
import { BlobService } from "azure-storage";
import { pipe } from "fp-ts/lib/function";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { getRequiredStringEnv } from "../utils/env";
import { PromiseType } from "@pagopa/ts-commons/lib/types";
import { inspect } from "util";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const endpoint = getRequiredStringEnv("COSMOSDB_URI");
const key = getRequiredStringEnv("COSMOSDB_KEY");
const storageConnectionString = getRequiredStringEnv(
  "LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING"
);
export const cosmosDatabaseName = getRequiredStringEnv("COSMOSDB_NAME");

//in jest 27 fail is no longer defined, we can define this function as workaround
function fail(reason = "fail was called in a test."): never {
  throw new Error(reason);
}

const client = new CosmosClient({ endpoint, key });

export const createDatabase = (
  dbName: string
): TE.TaskEither<CosmosErrors, Database> =>
  pipe(
    TE.tryCatch<
      CosmosErrors,
      PromiseType<ReturnType<typeof client.databases.createIfNotExists>>
    >(
      () => client.databases.createIfNotExists({ id: dbName }),
      toCosmosErrorResponse
    ),
    TE.map(databaseResponse => databaseResponse.database)
  );

export const makeRandomContainerName = (): NonEmptyString => {
  const result: string[] = [];
  const characters = "abcdefghijklmnopqrstuvwxyz";
  const charactersLength = characters.length;
  // eslint-disable-next-line functional/no-let
  for (let i = 0; i < 12; i++) {
    // eslint-disable-next-line functional/immutable-data
    result.push(
      characters.charAt(Math.floor(Math.random() * charactersLength))
    );
  }
  return `test-${result.join("")}` as NonEmptyString;
};

export const createContainer = (
  db: Database,
  containerName: string,
  partitionKey: string,
  indexingPolicy?: IndexingPolicy
): TE.TaskEither<CosmosErrors, Container> =>
  pipe(
    TE.tryCatch<
      CosmosErrors,
      PromiseType<ReturnType<typeof db.containers.createIfNotExists>>
    >(
      () =>
        db.containers.createIfNotExists({
          id: containerName,
          indexingPolicy,
          partitionKey: `/${partitionKey}`
        }),
      toCosmosErrorResponse
    ),
    TE.map(containerResponse => containerResponse.container)
  );

export const deleteContainer = (
  db: Database,
  containerName: string
): TE.TaskEither<CosmosErrors, Container> =>
  pipe(
    TE.tryCatch(
      () => db.container(containerName).delete(),
      toCosmosErrorResponse
    ),
    TE.map(containerResponse => containerResponse.container)
  );

export const createContext = (
  partitionKey: string,
  containerName: NonEmptyString,
  hasStorage = false
) => {
  let db: Database;
  let storage: BlobService;
  let container: Container;
  return {
    async init(indexingPolicy?: IndexingPolicy) {
      const r = await pipe(
        createDatabase(cosmosDatabaseName),
        TE.chain(db =>
          pipe(
            createContainer(db, containerName, partitionKey, indexingPolicy),
            TE.map(container => ({
              db,
              container
            }))
          )
        ),
        TE.getOrElseW<CosmosErrors, { db: Database; container: Container }>(_ =>
          fail(
            `Cannot init, container: ${containerName}, error: ${JSON.stringify(
              inspect(_)
            )}`
          )
        )
      )();
      if (hasStorage) {
        storage = new BlobService(storageConnectionString);
        await new Promise((resolve, reject) => {
          storage.createContainerIfNotExists(containerName, (err, res) =>
            err ? reject(err) : resolve(res)
          );
        });
      }
      db = r.db;
      container = r.container;
      return r;
    },
    async dispose() {
      await container.delete();
    },
    get db() {
      return db;
    },
    get container() {
      return container;
    },
    get containerName() {
      return containerName;
    },
    get storage() {
      return storage;
    }
  };
};
