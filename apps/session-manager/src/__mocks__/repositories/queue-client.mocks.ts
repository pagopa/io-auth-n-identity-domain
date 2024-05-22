import { QueueClient } from "@azure/storage-queue";
import { vi } from "vitest";

export const mockSendMessage = vi.fn();

export const mockQueueClient = {
  sendMessage: mockSendMessage,
} as unknown as QueueClient;
