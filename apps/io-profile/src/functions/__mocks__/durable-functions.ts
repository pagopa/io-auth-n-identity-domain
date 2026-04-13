import { vi } from "vitest";
import { InvocationContext } from "@azure/functions";
import { OrchestrationRuntimeStatus } from "durable-functions";

export const mockStartNew = vi.fn(
  async (_name: string, _options?: { instanceId?: string; input?: unknown }) =>
    "00000000-0000-0000-0000-000000000000",
);

export const mockGetClient = vi.fn(
  () =>
    ({
      startNew: mockStartNew,
    }) as any,
);

export const makeGetStatus404Error = (instanceId: string): Error =>
  new Error(
    `DurableClient error: Durable Functions extension replied with HTTP 404 response. ` +
    `This usually means we could not find any data associated with the instanceId provided: ${instanceId}.`
  );

export const app = {
  activity: vi.fn(),
  orchestration: vi.fn(),
};

export const input = {
  durableClient: vi.fn().mockReturnValue({}),
};

export const RetryOptions = vi.fn(() => ({}));

export const context = {
  debug: vi.fn().mockImplementation(console.log),
  error: vi.fn().mockImplementation(console.error),
  log: vi.fn().mockImplementation(console.log),
  warn: vi.fn().mockImplementation(console.warn),
  trace: vi.fn().mockImplementation(console.log),
} as unknown as InvocationContext;

