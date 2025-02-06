import { CosmosClient } from "@azure/cosmos";

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

export type ProblemSource = "AzureCosmosDB" | "AzureStorage" | "Config" | "Url";
// eslint-disable-next-line functional/prefer-readonly-type, @typescript-eslint/naming-convention
export type HealthProblem<S extends ProblemSource> = string & { __source: S };
export type HealthCheck<
  S extends ProblemSource = ProblemSource,
  True = true
> = TE.TaskEither<ReadonlyArray<HealthProblem<S>>, True>;

// format and cast a problem message with its source
export const formatProblem = <S extends ProblemSource>(
  source: S,
  message: string
): HealthProblem<S> => `${source}|${message}` as HealthProblem<S>;

// utility to format an unknown error to an arry of HealthProblem
export const toHealthProblems = <S extends ProblemSource>(source: S) => (
  e: unknown
): ReadonlyArray<HealthProblem<S>> => [
  formatProblem(source, E.toError(e).message)
];

/**
 * Return a CosmosClient
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const buildCosmosClient = (dbUri: string, dbKey?: string) =>
  new CosmosClient({
    endpoint: dbUri,
    key: dbKey
  });
