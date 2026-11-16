import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { getHealthCheckUseCase } from "../health-check.use-case.js";

const packageInfo = { name: "test-app", version: "1.0.0" };

describe("getHealthCheckUseCase", () => {
  it("returns package info when there are no dependencies", async () => {
    const result = await getHealthCheckUseCase(packageInfo)({});

    expect(result).toEqual(ok(packageInfo));
  });

  it("returns package info when dependencies are healthy", async () => {
    const result = await getHealthCheckUseCase(packageInfo, [
      {
        name: "healthy",
        port: { healthcheck: async () => ok(undefined) },
      },
    ])({});

    expect(result).toEqual(ok(packageInfo));
  });

  it("includes the named health-check function in the error stack", async () => {
    const result = await getHealthCheckUseCase(packageInfo, [
      {
        name: "unhealthy",
        port: {
          healthcheck: async () => err(new GenericError("unavailable")),
        },
      },
    ])({});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GenericError);
      expect(result.error.message).toBe(
        "Generic error: Health check failed for the following: [unhealthy]: Generic error: unavailable",
      );
      expect(result.error.stack).toMatch(/\bat healthcheck\b/);
    }
  });
});
