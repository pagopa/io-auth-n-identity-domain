import { describe, expect, it } from "vitest";

import { createConfigLoader } from "../adapters/outbound/config-loader.js";
import {
  ConfigSchema,
  DevelopmentConfigSchema,
  ProductionConfigSchema,
} from "../domain/value-objects/configs/index.js";

const baseEnvironment = {
  HOST: "0.0.0.0",
  PORT: "8080",
  NODE_ENV: "development",
};

describe("createConfigLoader", () => {
  it("loads development configuration without external service configuration", () => {
    const result = createConfigLoader(ConfigSchema, {
      environment: baseEnvironment,
    }).load();

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
    { HOST: "invalid-host" },
    { NODE_ENV: "invalid" },
    { HOST: undefined },
    { PORT: undefined },
    { NODE_ENV: undefined },
  ])("reports invalid configuration: %j", (environment) => {
    const result = createConfigLoader(ConfigSchema, {
      environment: { ...baseEnvironment, ...environment },
    }).load();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected configuration loading to fail");
    }
    expect(result.error.message).toContain("Validation failed");
  });

  it("rejects an empty environment", () => {
    const result = createConfigLoader(ConfigSchema, { environment: {} }).load();

    expect(result.isErr()).toBe(true);
  });

  it.each(["127.0.0.1", "::1", "localhost"])(
    "accepts server host %s in both environments",
    (HOST) => {
      for (const NODE_ENV of ["development", "production"]) {
        expect(
          ConfigSchema.parse({ ...baseEnvironment, HOST, NODE_ENV }),
        ).toEqual({ HOST, PORT: 8080, NODE_ENV });
      }
    },
  );

  it("enforces each environment-specific discriminator", () => {
    expect(DevelopmentConfigSchema.safeParse(baseEnvironment).success).toBe(
      true,
    );
    expect(ProductionConfigSchema.safeParse(baseEnvironment).success).toBe(
      false,
    );
    const productionEnvironment = {
      ...baseEnvironment,
      NODE_ENV: "production",
    };
    expect(
      ProductionConfigSchema.safeParse(productionEnvironment).success,
    ).toBe(true);
    expect(
      DevelopmentConfigSchema.safeParse(productionEnvironment).success,
    ).toBe(false);
  });
});
