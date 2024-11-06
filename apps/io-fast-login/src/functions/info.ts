import { pipe } from "fp-ts/lib/function";
import * as Task from "fp-ts/lib/Task";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";

import { HealthProblem } from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import {
  AzureCosmosProblemSource,
  makeAzureCosmosDbHealthCheck
} from "../utils/cosmos/health-check";
import { ApplicationInfo } from "../generated/definitions/internal/ApplicationInfo";
import { CosmosDBDependency } from "../utils/cosmos/dependency";
import { RedisDependency } from "../utils/redis/dependency";
import { makeRedisDBHealthCheck } from "../utils/redis/health-check";
import { HealthCheckBuilder } from "../utils/health-check";
type ProblemSource = AzureCosmosProblemSource;
const applicativeValidation = RTE.getApplicativeReaderTaskValidation(
  Task.ApplicativePar,
  RA.getSemigroup<HealthProblem<ProblemSource>>()
);

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  H.HttpResponse<ApplicationInfo, 200>,
  CosmosDBDependency & RedisDependency
> = H.of((_: H.HttpRequest) =>
  pipe(
    // TODO: Add all the function health checks
    [makeAzureCosmosDbHealthCheck, makeRedisDBHealthCheck] as ReadonlyArray<
      HealthCheckBuilder
    >,
    RA.sequence(applicativeValidation),
    RTE.map(() => H.successJson({ message: "it works!" })),
    RTE.mapLeft(problems => new H.HttpError(problems.join("\n\n")))
  )
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
