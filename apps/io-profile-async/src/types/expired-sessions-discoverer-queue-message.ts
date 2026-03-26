import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import * as t from "io-ts";

/**
 * Queue message for the maintenance trigger of ExpiredSessionsDiscoverer.
 * Allows specifying a target date to process expired sessions for.
 */
export const ExpiredSessionsDiscovererQueueMessage = t.type({
  date: DateFromString,
});

export type ExpiredSessionsDiscovererQueueMessage = t.TypeOf<
  typeof ExpiredSessionsDiscovererQueueMessage
>;
