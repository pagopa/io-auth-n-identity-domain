import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import {
  getCurrentBackendVersion,
  getValueFromPackageJson,
} from "../utils/package";

interface IPing {
  readonly name: string;
  readonly version: string;
}

type PingHandler = () => Promise<IResponseSuccessJson<IPing>>;

export function PingHandler(): PingHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async () =>
    ResponseSuccessJson({
      name: getValueFromPackageJson("name"),
      version: getCurrentBackendVersion(),
    });
}

export function Ping() {
  const handler = PingHandler();
  return wrapHandlerV4([], handler);
}
