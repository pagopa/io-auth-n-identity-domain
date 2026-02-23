import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import { PlatformInternalApiClient } from "../utils/platform-internal-client";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { trackEvent } from "../utils/appinsights";

const CACHEDEL_PROXY_ERROR_EVENT_NAME = "session.cachedel.error";
type Dependencies = {
  platformInternalApiClient: PlatformInternalApiClient;
};

const cacheDelSessionToken: RTE.ReaderTaskEither<
  Dependencies & { sessionToken: string },
  Error,
  true
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.platformInternalApiClient.deleteSession({
          "X-Session-Token": deps.sessionToken,
        }),
      E.toError,
    ),
    TE.chainEitherKW(
      E.mapLeft(
        (errors) =>
          new Error(
            `Error while decoding deleteSession response: ${readableReportSimplified(
              errors,
            )}`,
          ),
      ),
    ),
    TE.chain((response) =>
      response.status === 204
        ? TE.right(true as const)
        : TE.left(
            new Error(
              `Error while calling deleteSession API: status ${response.status}`,
            ),
          ),
    ),
    TE.mapLeft((error) => {
      // sending sampled event
      trackEvent({
        name: CACHEDEL_PROXY_ERROR_EVENT_NAME,
        properties: {
          errorMessage: error.message,
        },
      });
      return new Error("Error while calling internal proxy");
    }),
  );

export type PlatformInternalRepository = typeof PlatformInternalRepository;
export const PlatformInternalRepository = {
  cacheDelSessionToken,
};
