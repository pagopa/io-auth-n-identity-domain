import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import {
  FiscalCode,
  IPString,
  PatternString,
} from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as RTE from "fp-ts/ReaderTaskEither";
import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { LoginType, LoginTypeEnum } from "../types/fast-login";
import { base64EncodeObject } from "../utils/encoding";

export const SpidLogMessage = t.interface({
  // Timestamp of Request/Response creation
  createdAt: UTCISODateFromString,

  // Date of the SPID request / response in YYYY-MM-DD format
  createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),

  // Fiscal code of the authenticating user
  fiscalCode: t.union([t.undefined, FiscalCode]),

  // IP of the client that made a SPID login action
  ip: t.string.pipe(IPString),

  // Type of login
  loginType: withDefault(LoginType, LoginTypeEnum.LEGACY),

  // XML payload of the SPID Request
  requestPayload: t.string,

  // XML payload of the SPID Response
  responsePayload: t.string,

  // SPID request id
  spidRequestId: t.union([t.undefined, t.string]),
});
export type SpidLogMessage = t.TypeOf<typeof SpidLogMessage>;

/**
 * Send a message containing the spid logs data to a queue to be processed asynchronously
 * by another process to be stored.
 * @param deps The required Azure Queue client and the message that must be sent
 * @returns The reponse obtained from the queue client
 */
export const sendSpidLogsMessage: RTE.ReaderTaskEither<
  SpidLogsDependencies,
  Error,
  QueueSendMessageResponse
> = (deps) => {
  // encode to base64 since the queue payload is an XML
  // and cannot contain markup characters
  const spidMsgBase64 = base64EncodeObject(deps.spidLogMessage);

  // we don't return the promise here
  // the call follows fire & forget pattern
  return TE.tryCatch(
    () => deps.spidLogQueueClient.sendMessage(spidMsgBase64),
    E.toError,
  );
};

export type SpidLogsDependencies = {
  spidLogQueueClient: QueueClient;
  spidLogMessage: SpidLogMessage;
};
