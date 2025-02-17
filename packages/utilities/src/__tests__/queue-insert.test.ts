import { describe, it, expect, vi, beforeEach } from "vitest";
import * as E from "fp-ts/Either";
import NodeClient from "applicationinsights/out/Library/NodeClient";
import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import {
  CommonDependencies,
  Item,
  insertBatchIntoQueue,
  insertItemIntoQueue,
} from "../queue-insert";

const mockSendMessage = vi
  .fn()
  .mockResolvedValue({} as QueueSendMessageResponse);
const mockQueueClient = {
  sendMessage: mockSendMessage,
} as unknown as QueueClient;

const mockTrackEvent = vi.fn();
const mockAppInsights = {
  trackEvent: mockTrackEvent,
} as unknown as NodeClient;

const deps: CommonDependencies = {
  client: mockQueueClient,
  appInsightsTelemetryClient: mockAppInsights,
};

describe("Queue insert tests [Single]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send an item to queue storage", async () => {
    const anItem: Item<{ message: string }> = {
      payload: { message: "aMessage" },
    };
    const result = await insertItemIntoQueue({ ...deps, item: anItem })();

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(true));
  });

  it("should return an error in case something went wrong", async () => {
    const errorMessage = "errorMessage";
    mockSendMessage.mockRejectedValueOnce(errorMessage);
    const anItem: Item<{ message: string }> = {
      payload: { message: "aMessage" },
    };
    const result = await insertItemIntoQueue({ ...deps, item: anItem })();

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(Error(JSON.stringify(anItem.payload))));
  });
});

describe("Queue insert tests [Batch]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send a batch to queue storage", async () => {
    mockSendMessage.mockResolvedValueOnce({} as QueueSendMessageResponse);
    const anItem: Item<{ message: string }> = {
      payload: { message: "aMessage" },
    };
    const aBatch = [anItem, anItem];
    const result = await insertBatchIntoQueue({ ...deps, batch: aBatch })();

    expect(mockSendMessage).toHaveBeenCalledTimes(aBatch.length);
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(true));
  });

  it("should try to send all of the items, without stopping on error", async () => {
    const errorMessage = "errorMessage";
    mockSendMessage.mockRejectedValueOnce(errorMessage);
    mockSendMessage.mockResolvedValueOnce({} as QueueSendMessageResponse);
    const anItem: Item<{ message: string }> = {
      payload: { message: "aMessage" },
    };
    const aBatch = [anItem, anItem];
    const result = await insertBatchIntoQueue({ ...deps, batch: aBatch })();

    expect(mockSendMessage).toHaveBeenCalledTimes(aBatch.length);
    expect(mockSendMessage.mock.results).toEqual([
      { type: "throw", value: errorMessage },
      { type: "return", value: {} },
    ]);
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left([Error(JSON.stringify(anItem.payload))]));
  });

  it("should try to send all of the items, collecting all errors", async () => {
    const errorMessage = "errorMessage";
    mockSendMessage.mockRejectedValueOnce(errorMessage);
    mockSendMessage.mockRejectedValueOnce(errorMessage);
    const anItem: Item<{ message: string }> = {
      payload: { message: "aMessage" },
    };
    const aBatch = [anItem, anItem];
    const result = await insertBatchIntoQueue({ ...deps, batch: aBatch })();

    const expectedError = Error(JSON.stringify(anItem.payload));
    expect(mockSendMessage).toHaveBeenCalledTimes(aBatch.length);
    expect(mockSendMessage.mock.results).toEqual([
      { type: "throw", value: errorMessage },
      { type: "throw", value: errorMessage },
    ]);
    expect(mockTrackEvent).toHaveBeenCalledTimes(aBatch.length);

    expect(result).toEqual(E.left([expectedError, expectedError]));
  });
});
