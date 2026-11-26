import { describe, expect, it } from "vitest";

import { createConfigLoader } from "../adapters/outbound/config-loader.js";
import {
  ConfigSchema,
  DevelopmentConfigSchema,
  ProductionConfigSchema,
} from "../domain/value-objects/configs/index.js";

const sharedEnvironment = {
  HOST: "0.0.0.0",
  PORT: "8080",
  PLATFORM_PROXY_API_URL: "http://localhost:3009/",
  PLATFORM_PROXY_API_BASE_PATH: "/api/platform-internal/v1",
  AUTH_SESSIONS_TOPIC_NAME: "auth-sessions",
  COSMOSDB_NAME: "io-auth-SM",
  COSMOSDB_SESSION_TOKEN_CONTAINER_NAME: "session-tokens",
  COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME: "active-sessions",
  COSMOSDB_LOLLIPOP_ACTIVATION_CONTAINER_NAME: "lollipop-activations",
  LOLLIPOP_REVOCATION_QUEUE_NAME: "pubkeys-revoke",
  LOCKED_PROFILES_TABLE_NAME: "locked-profiles",
  PUSH_NOTIFICATIONS_QUEUE_NAME: "push-notifications",
  TECHNICAL_LOCKED_PROFILES_TABLE_NAME: "technical-locked-profiles",
};

const baseEnvironment = {
  ...sharedEnvironment,
  NODE_ENV: "development",
  SERVICE_BUS_CONNECTION_STRING:
    "Endpoint=sb://localhost/;SharedAccessKeyName=Root;SharedAccessKey=key",
  COSMOSDB_CONNECTION_STRING:
    "AccountEndpoint=https://localhost:8081/;AccountKey=Zm9v;",
  LOLLIPOP_REVOCATION_QUEUE_STORAGE_CONNECTION_STRING:
    "UseDevelopmentStorage=true",
  LOCKED_PROFILES_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true",
  PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true",
  TECHNICAL_LOCKED_PROFILES_STORAGE_CONNECTION_STRING:
    "UseDevelopmentStorage=true",
};

const productionEnvironment = {
  ...sharedEnvironment,
  HOST: "127.0.0.1",
  NODE_ENV: "production",
  SERVICE_BUS_HOSTNAME: "servicebus.example.com",
  COSMOSDB_URI: "https://cosmos.example.com",
  LOLLIPOP_REVOCATION_QUEUE_STORAGE_URI: "https://storage.example.com",
  LOCKED_PROFILES_STORAGE_ACCOUNT_URI: "https://storage.example.com",
  PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI: "https://storage.example.com",
  TECHNICAL_LOCKED_PROFILES_STORAGE_ACCOUNT_URI: "https://storage.example.com",
};

describe("createConfigLoader", () => {
  it("loads development configuration", () => {
    const result = createConfigLoader(ConfigSchema, {
      environment: baseEnvironment,
    }).load();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw result.error;
    }
    expect(result.value).toEqual({
      ...baseEnvironment,
      PLATFORM_PROXY_API_URL: new URL(baseEnvironment.PLATFORM_PROXY_API_URL),
      PORT: 8080,
    });
  });

  it("loads explicit production configuration", () => {
    const result = createConfigLoader(ConfigSchema, {
      environment: { ...productionEnvironment, PORT: "3000" },
    }).load();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw result.error;
    }
    expect(result.value).toEqual({
      ...productionEnvironment,
      PLATFORM_PROXY_API_URL: new URL(
        productionEnvironment.PLATFORM_PROXY_API_URL,
      ),
      PORT: 3000,
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
        const environment = {
          ...(NODE_ENV === "development"
            ? baseEnvironment
            : productionEnvironment),
          HOST,
          NODE_ENV,
        };

        expect(ConfigSchema.parse(environment)).toMatchObject({
          HOST,
          PORT: 8080,
          NODE_ENV,
        });
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
    expect(
      ProductionConfigSchema.safeParse(productionEnvironment).success,
    ).toBe(true);
    expect(
      DevelopmentConfigSchema.safeParse(productionEnvironment).success,
    ).toBe(false);
  });
});
