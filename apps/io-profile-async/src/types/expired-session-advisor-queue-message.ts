import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
/**
 * The state of the user' session
 */

// required attributes
export const ExpiredSessionAdvisorQueueMessage = t.type({
  fiscalCode: FiscalCode,
  expiredAt: DateFromTimestamp
});

export type ExpiredSessionAdvisorQueueMessage = t.TypeOf<
  typeof ExpiredSessionAdvisorQueueMessage
>;
