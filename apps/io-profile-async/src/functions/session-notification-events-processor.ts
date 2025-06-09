import { AzureFunction, Context } from "@azure/functions";
import {
  AuthSessionEvent,
  LoginEvent,
  LogoutEvent
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import {
  asyncIterableToArray,
  flattenAsyncIterable
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { Errors } from "io-ts";
import { ExpiredSessionDiscovererConfig } from "../config";
import { SessionNotifications } from "../models/session-notifications";
import {
  SessionNotificationsRepository,
  Dependencies as SessionNotificationsRepositoryDependencies
} from "../repositories/session-notifications";
import { trackEvent } from "../utils/appinsights";
import { getSelfFromModelValidationError } from "../utils/cosmos/errors";
import { PermanentError, TransientError } from "../utils/errors";

type TriggerDependencies = {
  SessionNotificationsRepo: SessionNotificationsRepository;
  expiredSessionsDiscovererConf: ExpiredSessionDiscovererConfig;
} & SessionNotificationsRepositoryDependencies;

const onBadRetrievedItem = (validationErrors: Errors): PermanentError => {
  const badRecordSelf = getSelfFromModelValidationError(validationErrors);

  trackEvent({
    name:
      "io.citizen-auth.prof-async.session-notification-events-processor.permanent.bad-record",
    properties: {
      message: "Found a non compliant db record",
      badRecordSelf
    },
    tagOverrides: {
      samplingEnabled: "false"
    }
  });

  return new PermanentError("Bad Record found on DB for given fiscalCode");
};

//TODO: try getting the messageId from contex and include it on customEvent in order to made debug easier!
const onBadMessageReceived = (validationErrors: Errors): PermanentError => {
  trackEvent({
    name:
      "io.citizen-auth.prof-async.session-notification-events-processor.permanent.bad-message",
    properties: {
      message: "Received A Bad Message",
      messageId: "TODO: placeholder"
    },
    tagOverrides: {
      samplingEnabled: "false"
    }
  });

  return new PermanentError("Bad Message Received");
};

// Method to retrieve from CosmosDB all items having the provided fiscalCode
export const retrievePreviousRecordFromDb: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  PermanentError | TransientError,
  ReadonlyArray<SessionNotifications>
> = (fiscalCode: FiscalCode) => deps =>
  pipe(
    deps.SessionNotificationsRepo.findByFiscalCodeAsyncIterable(
      fiscalCode,
      100
    )(deps),
    flattenAsyncIterable,
    asyncIterable =>
      TE.tryCatch(
        () => asyncIterableToArray(asyncIterable),
        () =>
          new TransientError(
            "Error retrieving session expirations, AsyncIterable fetch execution failure"
          )
      ),
    TE.chainW(
      flow(
        RA.traverse(E.Applicative)(identity),
        E.mapLeft(onBadRetrievedItem),
        TE.fromEither
      )
    )
  );

// Delete All retrievedRecords
export const deletePreviousRecords: (
  previousRecords: ReadonlyArray<SessionNotifications>
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  TransientError,
  void
> = previousRecords => deps =>
  pipe(
    previousRecords,
    RA.traverse(TE.ApplicativePar)(({ id, expiredAt }) =>
      deps.SessionNotificationsRepo.deleteRecord(id, expiredAt)(deps)
    ),
    TE.map(() => void 0),
    TE.mapLeft(
      () =>
        new TransientError("An Error occurred while deleting previous records")
    )
  );

// TODO: implements Create new record
export const createNewRecord = (
  fiscalCode: FiscalCode,
  expiredAt: Date
): RTE.ReaderTaskEither<TriggerDependencies, TransientError, void> =>
  pipe(RTE.of(void 0));

// 1. Retrieve all occurrences on DB for the event's fiscalCode
// 2. Delete all occurrences found on DB for the event's fiscalCode
export const processLogoutEvent = ({
  fiscalCode
}: LogoutEvent): RTE.ReaderTaskEither<
  TriggerDependencies,
  TransientError,
  void
> =>
  pipe(
    retrievePreviousRecordFromDb(fiscalCode),
    RTE.chain(deletePreviousRecords)
  );

// 1. Retrieve all occurrences on DB for the event's fiscalCode
// 2. Delete all occurrences found on DB for the event's fiscalCode
// 3. Create a new record using the event data
export const processLoginEvent = ({
  fiscalCode,
  expiredAt
}: LoginEvent): RTE.ReaderTaskEither<
  TriggerDependencies,
  TransientError,
  void
> =>
  pipe(
    retrievePreviousRecordFromDb(fiscalCode),
    RTE.chain(deletePreviousRecords),
    RTE.chain(() => createNewRecord(fiscalCode, expiredAt))
  );

export const SessionNotificationEventsProcessorFunction = (
  deps: TriggerDependencies
): AzureFunction => async (context: Context, message: unknown) =>
  pipe(
    AuthSessionEvent.decode(message),
    E.mapLeft(onBadMessageReceived),
    RTE.fromEither,
    RTE.chain(decodedMessage => {
      switch (decodedMessage.eventType) {
        case "login":
          return processLoginEvent(decodedMessage);
        case "logout":
          return processLogoutEvent(decodedMessage);
        default:
          return RTE.left(
            new PermanentError(
              `Unknown eventType received: ${decodedMessage.eventType}`
            )
          );
      }
    }),
    RTE.getOrElse(error => {
      //TODO: THROW ONLY ON TRANSIENT TO TRIGGER A RETRY
      context.log.error("Error=>", error.message);
      throw new Error("Error Processing ServiceBus Event");
    })
  )(deps)();
