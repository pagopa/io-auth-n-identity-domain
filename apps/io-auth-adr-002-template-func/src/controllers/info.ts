/* info.ts controller */
import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import { pipe } from "fp-ts/lib/function";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";
import { InfoService, InfoServiceDeps } from "../services/info";
type Dependencies = {
  InfoService: InfoService;
} & InfoServiceDeps;

export const makeInfoHandler: H.Handler<
  H.HttpRequest,
  H.HttpResponse<{ message: "success" }, 200>,
  Dependencies
> = H.of((_: H.HttpRequest) =>
  pipe(
    InfoService.pingCustomDependency,
    RTE.map(() => H.successJson({ message: "success" as const })),
    RTE.mapLeft((_problems) => new H.HttpError()),
  ),
);

export const InfoFunction = httpAzureFunction(makeInfoHandler);
