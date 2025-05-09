import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import { vi } from "vitest";

export const mockSendMessage = vi
  .fn()
  .mockResolvedValue({} as QueueSendMessageResponse);
export const mockQueueClient = {
  sendMessage: mockSendMessage,
} as unknown as QueueClient;
