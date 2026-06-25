import { pipe } from "fp-ts/lib/function";
import * as Task from "fp-ts/lib/Task";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { ContainerClient } from "@azure/storage-blob";

import {
  HealthProblem,
  ProblemSource,
  toHealthProblems
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import { ApplicationInfo } from "../generated/definitions/internal/ApplicationInfo";
import { RedisDependency } from "../utils/redis/dependency";
import { makeRedisDBHealthCheck } from "../utils/redis/health-check";
import { HealthCheckBuilder } from "../utils/health-check";

type AuditLogStorageDependency = {
  readonly auditLogContainerClient: ContainerClient;
};

const makeAuditLogStorageHealthCheck = ({
  auditLogContainerClient
}: AuditLogStorageDependency) =>
  pipe(
    // This check is intentionally read-only because audit containers are immutable.
    // It still validates the selected credential and target container before swap.
    TE.tryCatch(
      () => auditLogContainerClient.getProperties(),
      () => new Error("Error reading audit log container properties")
    ),
    TE.mapLeft(toHealthProblems("AuditLogStorage" as const)),
    TE.map(() => true)
  );

const applicativeValidation = RTE.getApplicativeReaderTaskValidation(
  Task.ApplicativePar,
  RA.getSemigroup<HealthProblem<ProblemSource<string>>>()
);

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  H.HttpResponse<ApplicationInfo, 200>,
  AuditLogStorageDependency & RedisDependency
> = H.of((_: H.HttpRequest) =>
  pipe(
    [
      makeRedisDBHealthCheck,
      makeAuditLogStorageHealthCheck
    ] as ReadonlyArray<HealthCheckBuilder>,
    RA.sequence(applicativeValidation),
    RTE.map(() => H.successJson({ message: "it works!" })),
    RTE.mapLeft(problems => new H.HttpError(problems.join("\n\n")))
  )
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
