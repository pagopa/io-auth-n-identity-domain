import { GenericError } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { withErrorResultLogging } from "../result-logging.middleware.js";

const mockLogger: Pick<Logger, "error"> = { error: vi.fn() };

describe("withErrorResultLogging", () => {
  it("logs an error result and returns it unchanged", async () => {
    const failure = err(new GenericError("Health check failed"));
    const useCase = vi.fn(async () => failure);
    const wrappedUseCase = withErrorResultLogging(mockLogger)(useCase);

    const result = await wrappedUseCase({});

    expect(result).toBe(failure);
    expect(useCase).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Request processing resulted in an error",
      { error: "Generic error: Health check failed" },
    );
  });

  it("does not log a successful result", async () => {
    const success = ok("healthy");
    const useCase = vi.fn(async () => success);
    const wrappedUseCase = withErrorResultLogging(mockLogger)(useCase);

    const result = await wrappedUseCase({});

    expect(result).toBe(success);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
