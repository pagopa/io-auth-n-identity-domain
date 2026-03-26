/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as healthcheck from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

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

export const InfoHandler = (
  checkApplicationHealth: HealthChecker
): InfoHandler => (): Promise<
  IResponseSuccessJson<ApplicationInfo> | IResponseErrorInternal
> =>
  pipe(
    envConfig,
    checkApplicationHealth,
    TE.map(_ =>
      ResponseSuccessJson({
        name: getValueFromPackageJson("name"),
        version: getCurrentBackendVersion()
      })
    ),
    TE.mapLeft(problems => ResponseErrorInternal(problems.join("\n\n"))),
    TE.toUnion
  )();

export const Info = () => {
  const handler = InfoHandler(healthcheck.checkApplicationHealth(IConfig, []));

  return wrapHandlerV4([], handler);
};
