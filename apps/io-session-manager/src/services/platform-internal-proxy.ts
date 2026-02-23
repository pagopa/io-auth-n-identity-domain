import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { SessionToken } from "../types/token";
import { PlatformInternalApiDeps } from "../repositories/platform-internal-api";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { AppInsightsDeps } from "../utils/appinsights";
import { log } from "../utils/logger";

export const CACHEDEL_PROXY_ERROR_EVENT_NAME = "session.cachedel.error";

export const cacheDelSessionToken =
  (
    sessionToken: SessionToken,
  ): RTE.ReaderTaskEither<
    PlatformInternalApiDeps & AppInsightsDeps,
    Error,
    true
  > =>
  (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.platformInternalApiClient.deleteSession({
            "X-Session-Token": sessionToken,
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
        log.error(error.message);
        // sending sampled event
        deps.appInsightsTelemetryClient?.trackEvent({
          name: CACHEDEL_PROXY_ERROR_EVENT_NAME,
          properties: {
            errorMessage: error.message,
          },
        });
        return new Error("Error while calling internal proxy");
      }),
    );
