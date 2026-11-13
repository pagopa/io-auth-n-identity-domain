import { describe, expect, it } from "vitest";

import { createConfigLoader } from "../adapters/outbound/config-loader.js";
import { ConfigSchema } from "../domain/value-objects/configs/index.js";

describe("createConfigLoader", () => {
  it("loads the base defaults without external service configuration", () => {
    const result = createConfigLoader(ConfigSchema, { environment: {} }).load();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw result.error;
    }
    expect(result.value).toEqual({
      HOST: "0.0.0.0",
      PORT: 8080,
      NODE_ENV: "development",
    });
  });

  it("loads explicit production configuration", () => {
    const result = createConfigLoader(ConfigSchema, {
      environment: {
        HOST: "127.0.0.1",
        PORT: "3000",
        NODE_ENV: "production",
      },
    }).load();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw result.error;
    }
    expect(result.value).toEqual({
      HOST: "127.0.0.1",
      PORT: 3000,
      NODE_ENV: "production",
    });
  });

  it.each([
    { PORT: "abc" },
    { PORT: "0" },
    { PORT: "65536" },
    { PORT: "1.5" },
    { HOST: "" },
    { NODE_ENV: "invalid" },
  ])("reports invalid configuration: %j", (environment) => {
    const result = createConfigLoader(ConfigSchema, { environment }).load();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected configuration loading to fail");
    }
    expect(result.error.message).toContain("Validation failed");
  });
});
