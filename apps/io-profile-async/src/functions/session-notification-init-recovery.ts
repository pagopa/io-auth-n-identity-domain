import * as E from "fp-ts/lib/Either";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { UserSessionInfo } from "../generated/definitions/sm-internal/UserSessionInfo";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { trackEvent } from "../utils/appinsights";
import { PermanentError, TransientError } from "../utils/errors";
import { SessionManagerInternalClientDependency } from "../utils/session-manager-internal-client/dependency";

export const retrieveSession: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  SessionManagerInternalClientDependency,
  TransientError,
  UserSessionInfo
> = (fiscalCode: FiscalCode) => ({
  sessionManagerInternalClient: backendInternalClient
}) =>
  pipe(
    TE.tryCatch(
      () => backendInternalClient.getSession({ fiscalCode }),
      () =>
        new TransientError(
          "Error while calling the downstream component [retrieveSession]"
        )
    ),
    TE.chainEitherK(
      E.mapLeft(
        _ =>
          new TransientError(
            "Unexpected response from backend internal [retrieveSession]"
          )
      )
    ),
    TE.chain(({ status, value }) =>
      status === 200
        ? TE.right(value)
        : TE.left(
            new TransientError(
              `Error while retrieving user session: downstream component returned ${status} [retrieveSession]`
            )
          )
    )
  );

export const SessionNotificationsInitRecoveryHandler: H.Handler<
  ExpiredSessionAdvisorQueueMessage,
  undefined,
  SessionManagerInternalClientDependency
> = H.of(({ fiscalCode, expiredAt }) =>
  pipe(
    retrieveSession(fiscalCode),
    RTE.filterOrElseW(
      userSessionInfo => userSessionInfo.active,
      () => new PermanentError("User has no active session")
    ),
    RTE.map(() => void 0), //TODO: continue here!!!
    RTE.orElseW(error => {
      if (error instanceof PermanentError) {
        trackEvent({
          name: "io.citizen-auth.prof-async.error.permanent",
          properties: {
            message: error.message
          },
          tagOverrides: {
            samplingEnabled: "false"
          }
        });
        return RTE.right(void 0);
      } else {
        return RTE.left(error);
      }
    })
  )
);

export const SessionNotificationsInitRecoveryFunction = azureFunction(
  SessionNotificationsInitRecoveryHandler
);
