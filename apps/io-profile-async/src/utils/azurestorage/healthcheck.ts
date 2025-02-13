import { GetPropertiesResponse, TableServiceClient } from "@azure/data-tables";
import { QueueServiceClient } from "@azure/storage-queue";
import {
  HealthCheck,
  HealthProblem,
  toHealthProblems
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";

import * as Task from "fp-ts/lib/Task";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as A from "fp-ts/lib/Array";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { AzureStorageDependency } from "./dependency";

export type AzureStorageProblemSource = "AzureStorage";
type ProblemSource = AzureStorageProblemSource;

const applicativeValidation = TE.getApplicativeTaskValidation(
  Task.ApplicativePar,
  RA.getSemigroup<HealthProblem<ProblemSource>>()
);

/**
 * Check the application can connect to an Azure Storage
 *
 * @param connStr connection string for the storage
 *
 * @returns either true or an array of error messages
 */
export const makeAzureStorageHealthCheck = ({
  connectionString
}: AzureStorageDependency): HealthCheck<AzureStorageProblemSource> =>
  // try to instantiate a client for each product of azure storage
  pipe(
    [
      // TODO: Blob service client
      QueueServiceClient.fromConnectionString(connectionString),
      TableServiceClient.fromConnectionString(connectionString)
    ]
      // for each, create a task that wraps getServiceProperties
      .map(serviceClient =>
        TE.tryCatch(
          () =>
            new Promise<GetPropertiesResponse>((resolve, reject) =>
              serviceClient.getProperties().then(
                result => {
                  resolve(result);
                },
                err => {
                  reject(err.message.replace(/\n/gim, " "));
                }
              )
            ),
          toHealthProblems("AzureStorage" as const)
        )
      ),
    // run each taskEither and gather validation errors from each one of them, if any
    A.sequence(applicativeValidation),
    TE.map(_ => true)
  );
