import { CosmosClient } from "@azure/cosmos";
import { GetPropertiesResponse, TableServiceClient } from "@azure/data-tables";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { apply } from "fp-ts";
import { toError } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { getConfig, IConfig } from "./config";

type ProblemSource = "AzureCosmosDB" | "AzureStorage" | "Config" | "Url";
// eslint-disable-next-line functional/prefer-readonly-type, @typescript-eslint/naming-convention
export type HealthProblem<S extends ProblemSource> = string & { __source: S };
export type HealthCheck<
  S extends ProblemSource = ProblemSource,
  T = true
> = TaskEither<ReadonlyArray<HealthProblem<S>>, T>;

// format and cast a problem message with its source
const formatProblem = <S extends ProblemSource>(
  source: S,
  message: string
): HealthProblem<S> => `${source}|${message}` as HealthProblem<S>;

// utility to format an unknown error to an arry of HealthProblem
const toHealthProblems = <S extends ProblemSource>(source: S) => (
  e: unknown
): ReadonlyArray<HealthProblem<S>> => [
  formatProblem(source, toError(e).message)
];

/**
 * Check application's configuration is correct
 *
 * @returns either true or an array of error messages
 */
export const checkConfigHealth = (): HealthCheck<"Config", IConfig> =>
  pipe(
    getConfig(),
    TE.fromEither,
    TE.mapLeft(errors =>
      // give each problem its own line
      errors.map(e => formatProblem("Config", readableReport([e])))
    )
  );

/**
 * Check the application can connect to an Azure CosmosDb instances
 *
 * @param dbUri uri of the database
 * @param dbUri connection string for the storage
 *
 * @returns either true or an array of error messages
 */
export const checkAzureCosmosDbHealth = (
  dbUri: string,
  dbKey?: string
): HealthCheck<"AzureCosmosDB", true> =>
  pipe(
    TE.Do,
    TE.bind("client", () => {
      const client = new CosmosClient({
        endpoint: dbUri,
        key: dbKey
      });
      return TE.right(client);
    }),
    TE.chain(({ client }) =>
      pipe(
        TE.tryCatch(
          () => client.getDatabaseAccount(),
          toHealthProblems("AzureCosmosDB")
        ),
        T.chainFirst(() => T.of(client.dispose()))
      )
    ),
    TE.map(_ => true)
  );

/**
 * Check the application can connect to an Azure Storage
 *
 * @param connStr connection string for the storage
 *
 * @returns either true or an array of error messages
 */
export const checkAzureStorageHealth = (
  connStr: string
): HealthCheck<"AzureStorage"> =>
  pipe(
    [TableServiceClient.fromConnectionString],
    // for each, create a task that wraps getServiceProperties
    RA.map(createService =>
      TE.tryCatch(
        () =>
          new Promise<GetPropertiesResponse>((resolve, reject) =>
            createService(connStr)
              .getProperties()
              .then(
                result => {
                  resolve(result);
                },
                err => {
                  reject(err.message.replace(/\n/gim, " ")); // avoid newlines
                }
              )
          ),
        toHealthProblems("AzureStorage")
      )
    ),
    TE.sequenceSeqArray,
    TE.map(_ => true)
  );

/**
 * Execute all the health checks for the application
 *
 * @returns either true or an array of error messages
 */
export const checkApplicationHealth = (): HealthCheck<ProblemSource, true> =>
  pipe(
    checkConfigHealth(),
    TE.chainW(config =>
      apply.sequenceT(TE.ApplySeq)<
        ReadonlyArray<HealthProblem<ProblemSource>>,
        // eslint-disable-next-line functional/prefer-readonly-type
        Array<TaskEither<ReadonlyArray<HealthProblem<ProblemSource>>, true>>
      >(
        checkAzureCosmosDbHealth(config.COSMOSDB_URI, config.COSMOSDB_KEY),
        checkAzureStorageHealth(
          config.MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING
        )
      )
    ),
    TE.map(_ => true)
  );
