import { describe, it, expect, vi } from "vitest";
import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { ExpiredSessionAdvisorQueueMessage } from "../../types/expired-session-advisor-queue-message";
import { base64EncodeObject } from "../../utils/encoding";
import { ExpiredUserSessionsQueueRepository } from "../expired-user-sessions-queue";

const encodedMessage = "encoded-message==";

vi.mock("../../utils/encoding", async () => {
  const actual = await vi.importActual("../../utils/encoding");
  return {
    ...actual,
    base64EncodeObject: vi.fn(() => encodedMessage)
  };
});

const anExpiredSessionAdvisorQueueMessage: ExpiredSessionAdvisorQueueMessage = {
  fiscalCode: "AAAAAA89S20I111X" as FiscalCode,
  expiredAt: new Date("2025-01-01T00:00:00Z")
};

const aQueueSendMessageResponse = {
  messageId: "abc123",
  popReceipt: "AgAAAAMAAAAAAAAA7rO8a8nF1gE="
} as QueueSendMessageResponse;

const sendMessageMock = vi.fn();

const queueClientMock = ({
  sendMessage: sendMessageMock
} as unknown) as QueueClient;

const deps = { expiredUserSessionsQueueClient: queueClientMock };

describe("ExpiredUserSessionsQueueRepository", () => {
  it("should send a message to the queue with correct encoding and visibilityTimeout", async () => {
    const visibilityTimeout = 42;
    sendMessageMock.mockResolvedValueOnce(aQueueSendMessageResponse);

    const result = await ExpiredUserSessionsQueueRepository.sendExpiredUserSession(
      anExpiredSessionAdvisorQueueMessage,
      visibilityTimeout
    )(deps)();

    expect(sendMessageMock).toHaveBeenCalledWith(encodedMessage, {
      visibilityTimeout
    });
    expect(result).toEqual({ _tag: "Right", right: aQueueSendMessageResponse });
  });

  it("should return a Left if sendMessage throws", async () => {
    const visibilityTimeout = 10;
    const error = new Error("fail");
    sendMessageMock.mockRejectedValueOnce(error);

    const result = await ExpiredUserSessionsQueueRepository.sendExpiredUserSession(
      anExpiredSessionAdvisorQueueMessage,
      visibilityTimeout
    )(deps)();

    expect(result).toStrictEqual(E.left(error));
  });

  it("should encode the message before sending", async () => {
    const visibilityTimeout = 10;
    sendMessageMock.mockResolvedValueOnce({} as QueueSendMessageResponse);

    await ExpiredUserSessionsQueueRepository.sendExpiredUserSession(
      anExpiredSessionAdvisorQueueMessage,
      visibilityTimeout
    )(deps)();

    expect(base64EncodeObject).toHaveBeenCalledWith({
      fiscalCode: anExpiredSessionAdvisorQueueMessage.fiscalCode,
      expiredAt: anExpiredSessionAdvisorQueueMessage.expiredAt.getTime()
    });
    expect(queueClientMock.sendMessage).toHaveBeenCalledWith(
      encodedMessage,
      expect.objectContaining({
        visibilityTimeout
      })
    );
  });
});
