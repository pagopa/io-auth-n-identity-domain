import { Database } from "@azure/cosmos";

import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";

import { log } from "./logger";
import {
  createContainer as createCollection,
  createDatabase,
  deleteContainer
} from "./cosmos_utils";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { Container } from "@azure/cosmos";

export const LOLLIPOP_COSMOSDB_COLLECTION_NAME = "lollipop-pubkeys";
export const LOLLIPOP_COSMOSDB_PK_FIELD = "assertionRef";

/**
 *
 * @param database
 * @returns
 */
export const createAllCollections = (
  database: Database
): TE.TaskEither<CosmosErrors, readonly Container[]> =>
  pipe(
    [
      createCollection(
        database,
        LOLLIPOP_COSMOSDB_COLLECTION_NAME,
        LOLLIPOP_COSMOSDB_PK_FIELD
      )
    ],
    RA.sequence(TE.ApplicativePar)
  );

/**
 * Create DB
 */
export const deleteAllCollections = (
  database: Database
): TE.TaskEither<CosmosErrors, readonly Container[]> => {
  log("deleting CosmosDB");

  return pipe(
    database,
    TE.of,
    TE.bindTo("db"),
    TE.bind("collectionNames", ({ db }) =>
      pipe(
        TE.tryCatch(
          () => db.containers.readAll().fetchAll(),
          toCosmosErrorResponse
        ),
        TE.map(r => r.resources),
        TE.map(RA.map(r => r.id))
      )
    ),
    TE.chain(({ db, collectionNames }) =>
      pipe(
        collectionNames,
        RA.map(r => deleteContainer(db, r)),
        RA.sequence(TE.ApplicativePar)
      )
    ),
    TE.map(collections => {
      log("Deleted", collections.length, "collections");
      return collections;
    }),
    TE.mapLeft(err => {
      log("Error", err);
      return err;
    })
  );
};

/**
 * Create DB and collections
 */
export const createCosmosDbAndCollections = (
  cosmosDbName: string
): TE.TaskEither<CosmosErrors, Database> =>
  pipe(
    createDatabase(cosmosDbName),
    // Delete all collections, in case they already exist
    TE.chainFirst(deleteAllCollections),
    TE.chainFirst(createAllCollections),
    TE.mapLeft(err => {
      log("Error", err);
      return err;
    })
  );
