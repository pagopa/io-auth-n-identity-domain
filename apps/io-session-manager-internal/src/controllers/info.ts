import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import { pipe } from "fp-ts/lib/function";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";

import {
  getCurrentBackendVersion,
  getValueFromPackageJson,
} from "../utils/package";

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<{ name: string; version: string }, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>
> = H.of((_: H.HttpRequest) =>
  pipe(
    RTE.of({
      name: getValueFromPackageJson("name"),
      version: getCurrentBackendVersion(),
    }),
    RTE.map(H.successJson),
    RTE.mapLeft(() => new H.HttpError()),
  ),
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
