import { vi } from "vitest";

export const mockStartNew = vi.fn(
  async () => "00000000-0000-0000-0000-000000000000"
);

export const mockGetClient = vi.fn(
  () =>
    ({
      startNew: mockStartNew
    } as any)
);

export const orchestrator = vi.fn();

export const RetryOptions = vi.fn(() => ({}));

export const context = {
  log: {
    error: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn()
  }
};
