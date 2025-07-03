import * as E from "fp-ts/lib/Either";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { identity, pipe } from "fp-ts/lib/function";

import { not } from "fp-ts/Predicate";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";

import {
  asyncIterableToArray,
  flattenAsyncIterable
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { UserSessionInfo } from "../generated/definitions/sm-internal/UserSessionInfo";
import {
  SessionNotificationsRepository,
  Dependencies as SessionNotificationsRepositoryDependencies
} from "../repositories/session-notifications";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { trackEvent } from "../utils/appinsights";
import { PermanentError, TransientError } from "../utils/errors";
import { SessionManagerInternalClientDependency } from "../utils/session-manager-internal-client/dependency";

export type TriggerDependencies = {
  SessionNotificationsRepo: SessionNotificationsRepository;
} & SessionNotificationsRepositoryDependencies &
  SessionManagerInternalClientDependency;

export const retrieveSession: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  SessionManagerInternalClientDependency,
  TransientError,
  UserSessionInfo
> = (fiscalCode: FiscalCode) => ({ sessionManagerInternalClient }) =>
  pipe(
    TE.tryCatch(
      () => sessionManagerInternalClient.getSession({ fiscalCode }),
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

// Method to check whether for a given fiscalCode there are already records in the CosmosDB container
const hasPreviousRecord: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<TriggerDependencies, TransientError, boolean> = (
  fiscalCode: FiscalCode
) => deps =>
  pipe(
    deps.SessionNotificationsRepo.findByFiscalCodeAsyncIterable(fiscalCode)(
      deps
    ),
    flattenAsyncIterable,
    asyncIterable =>
      TE.tryCatch(
        () => asyncIterableToArray(asyncIterable),
        err =>
          new TransientError(
            "Error retrieving session expirations, AsyncIterable fetch execution failure",
            E.toError(err)
          )
      ),
    TE.map(resultSet => resultSet.length > 0)
  );

// Write new record
const createNewRecord: (
  fiscalCode: FiscalCode,
  expiredAt: Date
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  PermanentError | TransientError,
  void
> = (fiscalCode, expiredAt) => deps =>
  pipe(
    deps.SessionNotificationsRepo.createRecord(
      fiscalCode,
      expiredAt.getTime()
    )(deps),
    TE.mapLeft(err =>
      err instanceof PermanentError
        ? err
        : new TransientError(
            "An Error occurred while creating a new session record",
            E.toError(err)
          )
    )
  );

export const SessionNotificationsInitRecoveryHandler: H.Handler<
  ExpiredSessionAdvisorQueueMessage,
  void,
  TriggerDependencies
> = H.of(({ fiscalCode, expiredAt }) =>
  pipe(
    retrieveSession(fiscalCode),
    RTE.filterOrElseW(
      userSessionInfo => userSessionInfo.active,
      () => new PermanentError("User has no active session")
    ),
    RTE.chainW(() => hasPreviousRecord(fiscalCode)),
    RTE.filterOrElseW(
      not(identity),
      () => new PermanentError("User already has records in container")
    ),
    RTE.chain(() => createNewRecord(fiscalCode, expiredAt)),
    RTE.orElseW(error => {
      if (error instanceof PermanentError) {
        trackEvent({
          name:
            "io.citizen-auth.prof-async.session-notification-init-recovery.permanent",
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
