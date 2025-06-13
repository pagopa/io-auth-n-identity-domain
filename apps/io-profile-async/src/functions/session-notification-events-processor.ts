import { AzureFunction, Context } from "@azure/functions";
import {
  AuthSessionEvent,
  EventTypeEnum,
  LoginEvent,
  LogoutEvent
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import { validationErrorsContainsKnownEventType } from "@pagopa/io-auth-n-identity-commons/utils/auth-session-event-utils";
import {
  asyncIterableToArray,
  flattenAsyncIterable
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as RT from "fp-ts/ReaderTask";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { Errors } from "io-ts";
import { SessionNotificationEventsProcessorConfig } from "../config";
import {
  SessionNotificationsRepository,
  Dependencies as SessionNotificationsRepositoryDependencies
} from "../repositories/session-notifications";
import { SessionNotificationsStrict } from "../types/session-notification-strict";
import { trackEvent } from "../utils/appinsights";
import { getSelfFromModelValidationError } from "../utils/cosmos/errors";
import { PermanentError, TransientError } from "../utils/errors";
import { isLastServiceBusTriggerRetry } from "../utils/function-utils";

export type TriggerDependencies = {
  SessionNotificationsRepo: SessionNotificationsRepository;
  sessionNotificationEventsProcessorConfig: SessionNotificationEventsProcessorConfig;
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

const onBadMessageReceived = (
  validationErrors: Errors
): TransientError | PermanentError => {
  if (validationErrorsContainsKnownEventType(validationErrors)) {
    // Returns a TransientError if the message has a known eventType
    // so that, after the various attempts, the message is moved to DLQ ready to be investigated.
    return new TransientError(`Bad Message Received having a known eventType`);
  }

  trackEvent({
    name:
      "io.citizen-auth.prof-async.session-notification-events-processor.permanent.bad-message",
    properties: {
      message: "Received A Bad Message",
      formattedError: readableReportSimplified(validationErrors)
    },
    tagOverrides: {
      samplingEnabled: "false"
    }
  });

  return new PermanentError(`Bad Message Received`);
};

const onBadTTLCalculated = (expiredAt: Date) => (
  validationErrors: Errors
): PermanentError => {
  trackEvent({
    name:
      "io.citizen-auth.prof-async.session-notification-events-processor.permanent.unable-to-calculate-ttl",
    properties: {
      message: "Unable to calculate TTL for new session record",
      expiredAt,
      formattedError: readableReportSimplified(validationErrors)
    },
    tagOverrides: {
      samplingEnabled: "false"
    }
  });

  return new PermanentError("Unable to calculate TTL for new session record");
};

// Method to retrieve from CosmosDB all items having the provided fiscalCode
const retrievePreviousRecordFromDb: (
  fiscalCode: FiscalCode
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  PermanentError | TransientError,
  ReadonlyArray<SessionNotificationsStrict>
> = (fiscalCode: FiscalCode) => deps =>
  pipe(
    deps.SessionNotificationsRepo.findByFiscalCodeAsyncIterable(
      fiscalCode,
      deps.sessionNotificationEventsProcessorConfig
        .SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
    )(deps),
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
    TE.map(flow(RA.map(E.bimap(onBadRetrievedItem, identity)), RA.rights))
  );

// Delete All retrievedRecords
const deletePreviousRecords: (
  previousRecords: ReadonlyArray<SessionNotificationsStrict>
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
      e =>
        new TransientError(
          `An Error occurred while deleting previous records => ${e.kind}`
        )
    )
  );

const createNewRecord: (
  fiscalCode: FiscalCode,
  expiredAt: Date
) => RTE.ReaderTaskEither<TriggerDependencies, TransientError, void> = (
  fiscalCode,
  expiredAt
) => deps =>
  pipe(
    calculateRecordTTL(
      expiredAt,
      deps.sessionNotificationEventsProcessorConfig
        .SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
    ),
    E.mapLeft(onBadTTLCalculated(expiredAt)),
    TE.fromEither,
    TE.chainW(ttl =>
      pipe(
        deps.SessionNotificationsRepo.createRecord(
          fiscalCode,
          expiredAt.getTime(),
          ttl
        )(deps),
        TE.mapLeft(
          err =>
            new TransientError(
              "An Error occurred while creating a new session record",
              E.toError(err)
            )
        )
      )
    )
  );

const calculateRecordTTL = (
  date: Date,
  offsetSeconds: number
): E.Either<Errors, NonNegativeInteger> =>
  pipe(
    Math.floor((date.getTime() - new Date().getTime()) / 1000) + offsetSeconds,
    NonNegativeInteger.decode
  );

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
const processLoginEvent = ({
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
): AzureFunction => async (context: Context, message: unknown): Promise<void> =>
  pipe(
    AuthSessionEvent.decode(message),
    E.mapLeft(onBadMessageReceived),
    RTE.fromEither,
    RTE.chainW(decodedMessage => {
      switch (decodedMessage.eventType) {
        case EventTypeEnum.LOGIN:
          return processLoginEvent(decodedMessage);
        case EventTypeEnum.LOGOUT:
          return processLogoutEvent(decodedMessage);
        default:
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const exhaustive: never = decodedMessage;
          return RTE.left(new PermanentError("Unexpected EventType"));
      }
    }),
    RTE.getOrElseW(error => {
      context.log.error("Error Processing Message, the reason was =>", error);
      if (error instanceof PermanentError) {
        return RT.of(void 0); // Permanent errors do not trigger a retry
      }

      // dedicated customEvent on last retry failed
      if (
        isLastServiceBusTriggerRetry(
          context,
          deps.sessionNotificationEventsProcessorConfig
            .SERVICEBUS_NOTIFICATION_EVENT_SUBSCRIPTION_MAX_DELIVERY_COUNT
        )
      ) {
        trackEvent({
          name:
            "io.citizen-auth.session-notification-events-processor.max-retry-reached",
          properties: {
            message: "Reached max retry for event processing",
            errorMessage: error.message,
            messageId: context.bindingData?.messageId ?? "N/A"
          },
          tagOverrides: {
            samplingEnabled: "false"
          }
        });
      }

      throw error;
    })
  )(deps)();
