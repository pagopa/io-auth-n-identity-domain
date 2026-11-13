import { GenericError, ValidationError } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { withErrorResultLogging } from "../result-logging.middleware.js";

const createMockLogger = (): Pick<
  Logger,
  "warn" | "trackException"
> => ({
  warn: vi.fn(),
  trackException: vi.fn(),
});

describe("withErrorResultLogging", () => {
  it("logs a generic error as an exception and returns it unchanged", async () => {
    const mockLogger = createMockLogger();
    const failure = err(new GenericError("Health check failed"));
    const useCase = vi.fn(async () => failure);
    const wrappedUseCase = withErrorResultLogging(mockLogger)(useCase);

    const result = await wrappedUseCase({});

    expect(result).toBe(failure);
    expect(useCase).toHaveBeenCalledOnce();
    expect(mockLogger.trackException).toHaveBeenCalledWith({
      error: failure.error,
    });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("logs other error results as warnings and returns them unchanged", async () => {
    const mockLogger = createMockLogger();
    const failure = err(new ValidationError("Invalid input"));
    const wrappedUseCase = withErrorResultLogging(mockLogger)(
      vi.fn(async () => failure),
    );

    const result = await wrappedUseCase({});

    expect(result).toBe(failure);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `${failure.error.kind}. Error: ${JSON.stringify(failure.error)}`,
    );
    expect(mockLogger.trackException).not.toHaveBeenCalled();
  });

  it("does not log a successful result", async () => {
    const mockLogger = createMockLogger();
    const success = ok("healthy");
    const useCase = vi.fn(async () => success);
    const wrappedUseCase = withErrorResultLogging(mockLogger)(useCase);

    const result = await wrappedUseCase({});

    expect(result).toBe(success);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.trackException).not.toHaveBeenCalled();
  });
});
