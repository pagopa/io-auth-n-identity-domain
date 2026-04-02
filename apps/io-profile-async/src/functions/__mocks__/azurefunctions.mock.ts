import { InvocationContext } from "@azure/functions";
import { vi } from "vitest";

export const contextMock = {
  log: vi.fn(),
  triggerMetadata: {},
} as unknown as InvocationContext;
