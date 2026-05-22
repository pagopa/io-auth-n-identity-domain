import { Buffer } from "node:buffer";
import type { Express } from "express";
import request from "supertest";
import { vi } from "vitest";

import { createFakeRedisHarness } from "./fake-redis";
import { createStubServer } from "./stub-server";

const setBackendTestEnv = (baseUrl: string) => {
  process.env.API_KEY = "backend-test-key";
  process.env.API_URL = baseUrl;
  process.env.AUTH_SESSIONS_TOPIC_NAME = "backend-test-auth-sessions-topic";
  process.env.BACKEND_HOST = "https://localhost";
  process.env.DEV_SERVICE_BUS_CONNECTION_STRING =
    "Endpoint=sb://stub.local;SharedAccessKeyName=stub;SharedAccessKey=stub;UseDevelopmentEmulator=true;";
  process.env.FAST_LOGIN_API_KEY = "backend-test-key";
  process.env.FAST_LOGIN_API_URL = baseUrl;
  process.env.IDP_METADATA_URL = `${baseUrl}/metadata/spid`;
  process.env.LOLLIPOP_API_BASE_PATH = "";
  process.env.LOLLIPOP_API_KEY = "backend-test-key";
  process.env.LOLLIPOP_API_URL = baseUrl;
  process.env.PLATFORM_PROXY_API_URL = baseUrl;
};

export const createBackendTestHarness = async () => {
  const fakeRedis = createFakeRedisHarness();
  const stubServer = await createStubServer();
  const lollipopQueueMessages: Array<{ readonly message: string }> = [];
  const platformInternalDeletes: Array<{
    readonly headers: {
      readonly "x-session-token": string;
    };
    readonly method: "DELETE";
    readonly path: "/sessions";
  }> = [];
  const serviceBusMessages: Array<{
    readonly message: unknown;
    readonly topicName: string;
  }> = [];

  setBackendTestEnv(stubServer.baseUrl);
  vi.resetModules();

  vi.doMock("../../repositories/redis", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../repositories/redis")>()),
    RedisClientSelector: () => async () => fakeRedis.selector,
  }));

  vi.doMock("../../repositories/platform-internal-client", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../repositories/platform-internal-client")>();
    const either = await import("fp-ts/Either");

    return {
      ...actual,
      getPlatformInternalAPIClient: () => ({
        deleteSession: async ({
          "X-Session-Token": sessionToken,
        }: {
          readonly "X-Session-Token": string;
        }) => {
          platformInternalDeletes.push({
            headers: {
              "x-session-token": sessionToken,
            },
            method: "DELETE",
            path: "/sessions",
          });
          return either.right({
            status: 204 as const,
            value: undefined,
          });
        },
      }),
    };
  });

  vi.doMock("../../utils/storages", () => ({
    initStorageDependencies: () => ({
      lockUserTableClient: {
        listEntities: () => ({
          async *[Symbol.asyncIterator]() {
            yield* [];
          },
        }),
      },
      lollipopRevokeQueueClient: {
        sendMessage: async (message: string) => {
          lollipopQueueMessages.push({ message });
          return {};
        },
      },
      notificationQueueClient: {
        sendMessage: async () => ({}),
      },
      spidLogQueueClient: {
        sendMessage: async () => ({}),
      },
    }),
  }));

  vi.doMock("@azure/service-bus", () => ({
    ServiceBusClient: class {
      public constructor(_connection: string) {}

      public createSender(topicName: string) {
        return {
          sendMessages: async (message: unknown) => {
            serviceBusMessages.push({ message, topicName });
          },
        };
      }
    },
  }));

  vi.doMock("@pagopa/io-spid-commons", () => ({
    withSpid:
      ({ app }: { readonly app: Express }) =>
      () =>
        Promise.resolve({
          app,
          idpMetadataRefresher: () => async () => undefined,
          spidConfigTime: 0n,
        }),
  }));

  vi.doMock("@pagopa/io-spid-commons/dist/utils/middleware", () => ({
    getSpidStrategyOption: () => ({
      idp: {
        stub: {
          entityID: "stub-idp",
        },
      },
    }),
  }));

  const { newApp } = await import("../../app.js");
  const { app } = await newApp({});

  return {
    app,
    close: async () => {
      app.emit("server:stop");
      await stubServer.stop();
    },
    http: request(app),
    lollipopQueueMessages,
    platformInternalDeletes,
    readDecodedLollipopQueueMessages: () =>
      lollipopQueueMessages.map(({ message }) =>
        JSON.parse(Buffer.from(message, "base64").toString("utf8")),
      ),
    redis: fakeRedis,
    reset: async () => {
      await fakeRedis.clear();
      lollipopQueueMessages.length = 0;
      platformInternalDeletes.length = 0;
      serviceBusMessages.length = 0;
      stubServer.reset();
    },
    serviceBusMessages,
    stubServer,
  };
};
