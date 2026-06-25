/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as healthcheck from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { ContainerClient } from "@azure/storage-blob";

import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import {
  getCurrentBackendVersion,
  getValueFromPackageJson
} from "../utils/package";

import { ApplicationInfo } from "../generated/definitions/internal/ApplicationInfo";
import { envConfig, IConfig } from "../utils/config";

type InfoHandler = () => Promise<
  IResponseSuccessJson<ApplicationInfo> | IResponseErrorInternal
>;

type HealthChecker = (
  config: unknown
) => healthcheck.HealthCheck<"AzureStorage" | "Config", true>;

export const InfoHandler =
  (
    checkApplicationHealth: HealthChecker,
    checkAuditStorageHealth: healthcheck.HealthCheck<"AuditLogStorage", true>
  ): InfoHandler =>
  (): Promise<IResponseSuccessJson<ApplicationInfo> | IResponseErrorInternal> =>
    pipe(
      envConfig,
      checkApplicationHealth,
      TE.chainW(() => checkAuditStorageHealth),
      TE.map(_ =>
        ResponseSuccessJson({
          name: getValueFromPackageJson("name"),
          version: getCurrentBackendVersion()
        })
      ),
      TE.mapLeft(problems => ResponseErrorInternal(problems.join("\n\n"))),
      TE.toUnion
    )();

const makeAuditStorageHealthCheck = (
  containerClient: ContainerClient
): healthcheck.HealthCheck<"AuditLogStorage", true> =>
  pipe(
    TE.tryCatch(
      () => containerClient.getProperties(),
      error => error
    ),
    TE.map(() => true as const),
    TE.mapLeft(healthcheck.toHealthProblems("AuditLogStorage" as const))
  );

export const Info = (containerClient: ContainerClient) => {
  const handler = InfoHandler(
    healthcheck.checkApplicationHealth(IConfig, []),
    makeAuditStorageHealthCheck(containerClient)
  );

  return wrapHandlerV4([], handler);
};
