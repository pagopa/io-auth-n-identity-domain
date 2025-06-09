import { AzureFunction, Context } from "@azure/functions";
import { AuthSessionEvent } from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { ExpiredSessionDiscovererConfig } from "../config";
import {
  SessionNotificationsRepository,
  Dependencies as SessionNotificationsRepositoryDependencies
} from "../repositories/session-notifications";

type TriggerDependencies = {
  SessionNotificationsRepo: SessionNotificationsRepository;
  expiredSessionsDiscovererConf: ExpiredSessionDiscovererConfig;
} & SessionNotificationsRepositoryDependencies;

export const SessionNotificationEventsProcessorFunction = (
  deps: TriggerDependencies
): AzureFunction => async (context: Context, message: unknown): Promise<void> =>
  pipe(
    AuthSessionEvent.decode(message),
    TE.fromEither,
    TE.map(decoded => {
      context.log.warn("RECEIVED EVENT=>", decoded);
    }),
    TE.getOrElse(error => {
      context.log.error("Error=>", readableReportSimplified(error));
      throw new Error("Error Processing ServiceBus Event");
    })
  )();
