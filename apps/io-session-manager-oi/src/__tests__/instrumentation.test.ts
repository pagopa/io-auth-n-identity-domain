import { initAzureMonitor } from "@pagopa/azure-tracing/azure-monitor";
import { describe, expect, it, vi } from "vitest";

vi.mock("@pagopa/azure-tracing/azure-monitor", () => ({
  initAzureMonitor: vi.fn(),
}));

describe("instrumentation", () => {
  it("initializes Azure Monitor instrumentation", async () => {
    await import("../instrumentation.js");

    expect(initAzureMonitor).toHaveBeenCalledExactlyOnceWith();
  });
});
