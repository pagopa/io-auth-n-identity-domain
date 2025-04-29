import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";

import { pipe } from "fp-ts/lib/function";
import { ApplicationInfo } from "../generated/definitions/internal/ApplicationInfo";
import { InfoService, InfoServiceDeps } from "../services/info";

type Dependencies = {
  InfoService: InfoService;
} & InfoServiceDeps;

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  H.HttpResponse<ApplicationInfo, 200> | H.HttpResponse<unknown, 500>,
  Dependencies
> = H.of((_: H.HttpRequest) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chain(({ InfoService, PackageUtils }) =>
      RTE.fromTaskEither(InfoService.getPackageInfo({ PackageUtils })),
    ),
    RTE.map((info) => H.successJson(info)),
    RTE.mapLeft((_problems) => new H.HttpError()),
  ),
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
