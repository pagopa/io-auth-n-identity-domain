import * as H from "@pagopa/handler-kit";
import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import {
  HealthProblem,
  ProblemSource
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as Task from "fp-ts/lib/Task";
import * as RTE from "fp-ts/ReaderTaskEither";
import { AzureStorageDependency } from "../utils/azurestorage/dependency";
import { makeAzureStorageHealthCheck } from "../utils/azurestorage/healthcheck";
import { CosmosDBDependency } from "../utils/cosmos/dependency";
import { makeAzureCosmosDbHealthCheck } from "../utils/cosmos/healthcheck";
import { HealthCheckBuilder } from "../utils/healthcheck";
import {
  getCurrentBackendVersion,
  getValueFromPackageJson
} from "../utils/package";

const applicativeValidation = RTE.getApplicativeReaderTaskValidation(
  Task.ApplicativePar,
  RA.getSemigroup<HealthProblem<ProblemSource<string>>>()
);

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<{ name: string; version: string }, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  AzureStorageDependency & CosmosDBDependency
> = H.of((_: H.HttpRequest) =>
  pipe(
    [
      makeAzureStorageHealthCheck,
      makeAzureCosmosDbHealthCheck
    ] as ReadonlyArray<HealthCheckBuilder>,
    RA.sequence(applicativeValidation),
    RTE.map(() =>
      H.successJson({
        name: getValueFromPackageJson("name"),
        version: getCurrentBackendVersion()
      })
    ),
    RTE.orElseW(error =>
      RTE.right(
        H.problemJson({ status: 500 as const, title: error.join("\n\n") })
      )
    )
  )
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
