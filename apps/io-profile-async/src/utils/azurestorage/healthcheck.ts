import {
  QueueGetPropertiesResponse,
  QueueServiceClient
} from "@azure/storage-queue";
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
import {
  BlobGetPropertiesResponse,
  BlobServiceClient
} from "@azure/storage-blob";
import {
  TableServiceClient,
  GetPropertiesResponse as TableGetPropertiesResponse
} from "@azure/data-tables";
import { AzureStorageDependency } from "./dependency";

export type AzureStorageProblemSource = "AzureStorage";

const applicativeValidation = TE.getApplicativeTaskValidation(
  Task.ApplicativePar,
  RA.getSemigroup<HealthProblem<AzureStorageProblemSource>>()
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
      BlobServiceClient.fromConnectionString(connectionString),
      QueueServiceClient.fromConnectionString(connectionString),
      TableServiceClient.fromConnectionString(connectionString)
    ]
      // for each, create a task that wraps getServiceProperties
      .map(serviceClient =>
        TE.tryCatch(
          () =>
            new Promise<
              | BlobGetPropertiesResponse
              | QueueGetPropertiesResponse
              | TableGetPropertiesResponse
            >((resolve, reject) =>
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
