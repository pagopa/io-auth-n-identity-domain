import { AzureCosmosResource } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { NotificationEvents } from "../models/session-notifications";

export const SessionNotificationsStrict = t.type({
  id: FiscalCode,
  expiredAt: t.number,
  notificationEvents: NotificationEvents
});

export type SessionNotificationsStrict = t.TypeOf<
  typeof SessionNotificationsStrict
>;

export const RetrievedSessionNotificationsStrict = t.intersection([
  SessionNotificationsStrict,
  AzureCosmosResource
]);

export type RetrievedSessionNotificationsStrict = t.TypeOf<
  typeof RetrievedSessionNotificationsStrict
>;
