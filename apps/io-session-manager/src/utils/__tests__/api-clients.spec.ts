import { beforeAll, afterAll, describe, expect, test, vi } from "vitest";
import ServerMock from "mock-http-server";
import { createClient as FnAppClient } from "../../generated/io-profile/client";
import { createClient as FastLoginClient } from "../../generated/fast-login-api/client";
import { createClient as LollipopClient } from "../../generated/lollipop-api/client";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "../fetch";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import { aJwkPubKey } from "../../__mocks__/lollipop.mocks";

const PORT = 9000;
vi.mock("../../repositories/fn-app-api", () => ({
  FnAppAPIClient: (_, __, fetchApi) =>
    FnAppClient({
      baseUrl: `http://localhost:${PORT}`,
      fetchApi,
    }),
}));

vi.mock("../../repositories/fast-login-api", () => ({
  getFnFastLoginAPIClient: (_, __, basePath, fetchApi) =>
    FastLoginClient({
      baseUrl: `http://localhost:${PORT}`,
      basePath,
      fetchApi,
    }),
}));

vi.mock("../../repositories/lollipop-api", () => ({
  getLollipopApiClient: (_, __, basePath, fetchApi) =>
    LollipopClient({
      baseUrl: `http://localhost:${PORT}`,
      basePath,
      fetchApi,
    }),
}));

import { initAPIClientsDependencies } from "../api-clients";

describe("initAPIClientsDependencies", () => {
  const server = new ServerMock({ host: "localhost", port: PORT }, undefined);
  server.on({
    method: "GET",
    path: `/api/v1/profiles/${aFiscalCode}`,
    reply: {
      status: 200,
      body: JSON.stringify({ foo: "bar" }),
    },
    delay: DEFAULT_REQUEST_TIMEOUT_MS + 100,
  });
  server.on({
    method: "POST",
    path: `/api/v1/nonce/generate`,
    reply: {
      status: 200,
      body: JSON.stringify({ foo: "bar" }),
    },
    delay: DEFAULT_REQUEST_TIMEOUT_MS + 100,
  });
  server.on({
    method: "POST",
    path: `/api/v1/pubkeys`,
    reply: {
      status: 200,
      body: JSON.stringify({ foo: "bar" }),
    },
    delay: DEFAULT_REQUEST_TIMEOUT_MS + 100,
  });

  beforeAll(async () => new Promise((resolve) => server.start(resolve)));

  afterAll(async () => new Promise((resolve) => server.stop(resolve)));

  test(
    "The FnAppAPIClient should abort the request if the server responde slowly",
    { timeout: DEFAULT_REQUEST_TIMEOUT_MS + 500, concurrent: true },
    async () => {
      const { fnAppAPIClient } = initAPIClientsDependencies();

      await expect(
        fnAppAPIClient.getProfile({
          fiscal_code: aFiscalCode,
        }),
      ).rejects.toThrow(/aborted|ECONNREFUSED/);
    },
  );

  test(
    "The FnFastLoginAPIClient should abort the request if the server responde slowly",
    { timeout: DEFAULT_REQUEST_TIMEOUT_MS + 500, concurrent: true },
    async () => {
      const { fnFastLoginAPIClient } = initAPIClientsDependencies();

      await expect(fnFastLoginAPIClient.generateNonce({})).rejects.toThrow(
        /aborted|ECONNREFUSED/,
      );
    },
  );

  test(
    "The FnFastLoginAPIClient should abort the request if the server responde slowly",
    { timeout: DEFAULT_REQUEST_TIMEOUT_MS + 500, concurrent: true },
    async () => {
      const { fnLollipopAPIClient } = initAPIClientsDependencies();

      await expect(
        fnLollipopAPIClient.reservePubKey({
          body: {
            algo: JwkPubKeyHashAlgorithmEnum.sha256,
            pub_key: aJwkPubKey,
          },
        }),
      ).rejects.toThrow(/aborted|ECONNREFUSED/);
    },
  );
});
