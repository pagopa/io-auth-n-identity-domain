import { QueueServiceClient } from "@azure/storage-queue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { context } from "../__mocks__/durable-functions";
import { aFiscalCode } from "../__mocks__/mocks";
import {
  GetEnqueueProfileCreationEventActivityHandler,
  NewProfileInput,
} from "../enqueue-profile-creation-event-activity";

const mockSendMessage = vi.fn();
const mockQueueService = {
  getQueueClient: vi
    .fn()
    .mockImplementation(() => ({ sendMessage: mockSendMessage })),
} as unknown as QueueServiceClient;

const aQueueName = "queue_name";

const expectedMessagePayload: NewProfileInput = {
  fiscal_code: aFiscalCode,
};

describe("GetEnqueueProfileCreationEventActivityHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("Should send a message if the activity input is valid", async () => {
    const handler =
      GetEnqueueProfileCreationEventActivityHandler(mockQueueService);
    mockSendMessage.mockImplementation(() => Promise.resolve());
    const result = await handler({
      fiscalCode: aFiscalCode,
      queueName: aQueueName,
    }, context as any);
    expect(result).toEqual("SUCCESS");
    expect(mockSendMessage).toBeCalledWith(
      Buffer.from(JSON.stringify(expectedMessagePayload)).toString("base64"),
    );
    expect(mockQueueService.getQueueClient).toBeCalledWith(aQueueName);
  });

  it("Should return permanent error when the input is invalid", async () => {
    const handler =
      GetEnqueueProfileCreationEventActivityHandler(mockQueueService);
    mockSendMessage.mockImplementation(() => Promise.resolve());
    // eslint-disable-next-line no-new, no-unused-expressions
    const result = await handler({
      fiscalCode: aFiscalCode,
    }, context as any);
    expect(result).toEqual("FAILURE");
    expect(context.error).toBeCalled();
    expect(mockQueueService.getQueueClient).not.toBeCalled();
  });

  it("Should return transient error if queue service fail", async () => {
    const handler =
      GetEnqueueProfileCreationEventActivityHandler(mockQueueService);
    mockSendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("Error")),
    );
    // eslint-disable-next-line no-new, no-unused-expressions
    await expect(
      handler({
        fiscalCode: aFiscalCode,
        queueName: aQueueName,
      }, context as any),
    ).rejects.toEqual(expect.any(Error));
    expect(mockQueueService.getQueueClient).toBeCalledWith(aQueueName);
    expect(mockSendMessage).toBeCalledWith(
      Buffer.from(JSON.stringify(expectedMessagePayload)).toString("base64"),
    );
    expect(context.error).toBeCalled();
  });
});
