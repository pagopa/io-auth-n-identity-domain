import { QueueClient } from "@azure/storage-queue";
import { Mock, vi } from "vitest";

export const mockSendMessage: Mock<
  Parameters<QueueClient["sendMessage"]>,
  ReturnType<QueueClient["sendMessage"]>
> = vi.fn();

export const mockQueueClient = {
  sendMessage: mockSendMessage,
} as unknown as QueueClient;
