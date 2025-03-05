import * as t from "io-ts";

import {
  IPString,
  NonEmptyString,
  PatternString
} from "@pagopa/ts-commons/lib/strings";
import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { EncryptedPayload } from "@pagopa/ts-commons/lib/encrypt";

/**
 * Payload of the message retrieved from the queue
 * (one for each SPID request or response).
 */
export const StoreSpidLogsQueueMessage = t.intersection([
  t.interface({
    // Timestamp of Request/Response creation
    createdAt: UTCISODateFromString,

    // Date of the SPID request / response in YYYY-MM-DD format
    createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),

    // IP of the client that made a SPID login action
    ip: IPString,

    // login type value
    loginType: NonEmptyString,

    // XML payload of the SPID Request
    requestPayload: t.string,

    // XML payload of the SPID Response
    responsePayload: t.string,

    // SPID request ID
    spidRequestId: t.string
  }),
  t.partial({
    // SPID user fiscal code
    fiscalCode: t.string
  })
]);

export type StoreSpidLogsQueueMessage = t.TypeOf<
  typeof StoreSpidLogsQueueMessage
>;

/**
 * Payload of the stored blob item
 * (one for each SPID request or response).
 */
export const SpidBlobItem = t.interface({
  // Timestamp of Request/Response creation
  createdAt: UTCISODateFromString,

  // IP of the client that made a SPID login action
  ip: IPString,

  // XML payload of the SPID Request
  // eslint-disable-next-line sort-keys
  encryptedRequestPayload: EncryptedPayload,

  // XML payload of the SPID Response
  encryptedResponsePayload: EncryptedPayload,

  // SPID request ID
  spidRequestId: t.string
});

export type SpidBlobItem = t.TypeOf<typeof SpidBlobItem>;
