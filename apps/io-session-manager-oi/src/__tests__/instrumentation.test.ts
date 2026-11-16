import { initAzureMonitor } from "@pagopa/azure-tracing/azure-monitor";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  FastifyOtelInstrumentation: vi.fn(),
  initAzureMonitor: vi.fn(),
}));

vi.mock("@fastify/otel", () => ({
  FastifyOtelInstrumentation: mocks.FastifyOtelInstrumentation,
}));

vi.mock("@pagopa/azure-tracing/azure-monitor", () => ({
  initAzureMonitor: mocks.initAzureMonitor,
}));

describe("instrumentation", () => {
  it("initializes Azure Monitor instrumentation", async () => {
    await import("../instrumentation.js");

    expect(mocks.FastifyOtelInstrumentation).toHaveBeenCalledExactlyOnceWith({
      registerOnInitialization: true,
    });
    expect(initAzureMonitor).toHaveBeenCalledExactlyOnceWith([
      mocks.FastifyOtelInstrumentation.mock.instances[0],
    ]);
  });
});
