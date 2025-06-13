import { Context } from "@azure/functions";
import { vi } from "vitest";

export const contextMock = ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn()
  },
  executionContext: {}
} as unknown) as Context;
