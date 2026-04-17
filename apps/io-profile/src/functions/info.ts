import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { checkApplicationHealth } from "../utils/healthcheck";
import { HealthCheck } from "../utils/healthcheck-utils";
import {
  getCurrentBackendVersion,
  getValueFromPackageJson,
} from "../utils/package";

interface IInfo {
  readonly name: string;
  readonly version: string;
}

type InfoHandler = () => Promise<
  IResponseSuccessJson<IInfo> | IResponseErrorInternal
>;

export function InfoHandler(healthCheck: HealthCheck): InfoHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return () =>
    pipe(
      healthCheck,
      TE.bimap(
        (problems) => ResponseErrorInternal(problems.join("\n\n")),
        (_) =>
          ResponseSuccessJson({
            name: getValueFromPackageJson("name"),
            version: getCurrentBackendVersion(),
          }),
      ),
      TE.toUnion,
    )();
}

export function Info() {
  const handler = InfoHandler(checkApplicationHealth());
  return wrapHandlerV4([], handler);
}
