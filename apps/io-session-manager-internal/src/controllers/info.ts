import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";

import {
  getCurrentBackendVersion,
  getValueFromPackageJson,
} from "../utils/package";

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  H.HttpResponse<{ name: string; version: string }, 200>
> = H.of((_: H.HttpRequest) =>
  RTE.of(
    H.successJson({
      name: getValueFromPackageJson("name"),
      version: getCurrentBackendVersion(),
    }),
  ),
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
