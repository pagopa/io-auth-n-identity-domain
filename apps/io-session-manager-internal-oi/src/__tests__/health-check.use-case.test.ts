import { GenericError } from "@pagopa/hexagonal-core";
import type { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { getHealthCheckUseCase } from "../application/use-cases/health-check.use-case.js";

const packageInfo = {
  name: "io-session-manager-internal-oi",
  version: "0.0.0",
};

describe("getHealthCheckUseCase", () => {
  it("returns package metadata when no adapters are provided", async () => {
    const result = await getHealthCheckUseCase(packageInfo)({});

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw result.error;
    }
    expect(result.value).toEqual(packageInfo);
  });

  it("returns package metadata when all adapters are healthy", async () => {
    const port: HealthCheckOutboundPort = {
      healthcheck: vi.fn().mockResolvedValue(ok(undefined)),
    };
    const result = await getHealthCheckUseCase(packageInfo, [
      { name: "adapter", port },
    ])({});

    expect(port.healthcheck).toHaveBeenCalledTimes(1);
    expect(result.isOk()).toBe(true);
  });

  it("reports both returned errors and rejected health checks", async () => {
    const failingPort: HealthCheckOutboundPort = {
      healthcheck: vi
        .fn()
        .mockResolvedValue(err(new GenericError("unhealthy"))),
    };
    const rejectingPort: HealthCheckOutboundPort = {
      healthcheck: vi.fn().mockRejectedValue(new Error("unreachable")),
    };
    const result = await getHealthCheckUseCase(packageInfo, [
      { name: "failing", port: failingPort },
      { name: "rejecting", port: rejectingPort },
    ])({});

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected health check to fail");
    }
    expect(result.error.message).toBe(
      "Generic error: Health check failed for the following: [failing]: Generic error: unhealthy| [rejecting]: Error: unreachable",
    );
  });
});
