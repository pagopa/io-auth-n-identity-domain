import { describe, test, expect, vi, beforeEach } from "vitest";
import { QueueClient } from "@azure/storage-queue";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import {
  aSAMLRequest,
  aSamlRequestId,
  getASAMLResponse,
} from "../../__mocks__/spid.mocks";
import { LoginTypeEnum } from "../../types/fast-login";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { sendSpidLogsMessage } from "../spid-logs";

const mockSendMessage = vi.fn().mockImplementation(() => Promise.resolve());
const mockQueueClient = {
  sendMessage: mockSendMessage,
} as unknown as QueueClient;

const aSAMLResponse = getASAMLResponse();

const aSpidLogMessage = {
  createdAt: new Date().toISOString() as unknown as Date,
  createdAtDay: "01/01/2024",
  fiscalCode: aFiscalCode,
  ip: "127.0.0.1" as IPString,
  loginType: LoginTypeEnum.LEGACY,
  requestPayload: aSAMLRequest,
  responsePayload: aSAMLResponse,
  spidRequestId: aSamlRequestId,
};

describe("SpidLogsRepo#sendSpidLogsMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("should send a message using the queue client", async () => {
    const result = await pipe(
      sendSpidLogsMessage({
        spidLogQueueClient: mockQueueClient,
        spidLogMessage: aSpidLogMessage,
      }),
      TE.map(() => {
        const b64 = mockSendMessage.mock.calls[0][0];
        const val = JSON.parse(Buffer.from(b64, "base64").toString("binary"));
        expect(val).toEqual(aSpidLogMessage);
      }),
    )();

    expect(E.isRight(result)).toBeTruthy();
  });

  test("should return an error if the queue client throw an exception", async () => {
    const expectedError = new Error("error");
    mockSendMessage.mockRejectedValueOnce(expectedError);

    const result = await pipe(
      sendSpidLogsMessage({
        spidLogQueueClient: mockQueueClient,
        spidLogMessage: aSpidLogMessage,
      }),
      TE.mapLeft((err) => {
        expect(err).toEqual(expectedError);
      }),
    )();

    expect(E.isLeft(result)).toBeTruthy();
  });
});
