import { beforeAll, describe, expect, it, vi } from "vitest";

import { envConfig } from "../../__mocks__/env-config.mock";

import * as E from "fp-ts/lib/Either";
import * as config from "../config";

import {
  checkApplicationHealth,
  checkAzureCosmosDbHealth,
  checkAzureStorageHealth,
  checkUrlHealth
} from "../healthcheck";

import * as healthcheckUtils from "../healthcheck-utils";

import { CosmosClient } from "@azure/cosmos";
import { right } from "fp-ts/lib/Either";

const getBlobServiceKO = (name: string) => ({
  getServiceProperties: vi
    .fn()
    .mockImplementation(callback =>
      callback(Error(`error - ${name}`), null, null as unknown)
    )
});

const {
  createBlobService,
  createFileService,
  createQueueService,
  createTableService
} = vi.hoisted(() => {
  const blobServiceOk = {
    getServiceProperties: vi
      .fn()
      .mockImplementation(callback =>
        callback((null as unknown) as Error, "ok", null as unknown)
      )
  };
  return {
    createBlobService: vi.fn(_ => blobServiceOk),
    createFileService: vi.fn(_ => blobServiceOk),
    createQueueService: vi.fn(_ => blobServiceOk),
    createTableService: vi.fn(_ => blobServiceOk)
  };
});

vi.mock("azure-storage", async () => {
  const actual = await vi.importActual("azure-storage");
  return {
    ...(actual as any),
    createBlobService,
    createFileService,
    createQueueService,
    createTableService
  };
});

// Cosmos DB mock

const mockGetDatabaseAccountOk = async () => {};
const mockGetDatabaseAccountKO = async () => {
  throw Error("Error calling Cosmos Db");
};

const mockGetDatabaseAccount = vi
  .fn()
  .mockImplementation(mockGetDatabaseAccountOk);

function mockCosmosClient() {
  vi.spyOn(healthcheckUtils, "buildCosmosClient").mockReturnValue(({
    getDatabaseAccount: mockGetDatabaseAccount
  } as unknown) as CosmosClient);
}

// -------------
// TESTS
// -------------

describe("healthcheck - storage account", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  it("should not throw exception", async () => {
    const res = await checkAzureStorageHealth("")();
    expect(res).toEqual(E.right(true));
  });
  it.each`
    name                    | toMock
    ${"createBlobService"}  | ${createBlobService}
    ${"createFileService"}  | ${createFileService}
    ${"createQueueService"} | ${createQueueService}
    ${"createTableService"} | ${createTableService}
  `("should throw exception $name", async ({ name, toMock }) => {
    const blobServiceKO = getBlobServiceKO(name);
    toMock.mockReturnValueOnce(blobServiceKO);

    console.log(`EXECUTING ${name}`);
    const res = await checkAzureStorageHealth("")();
    expect(res).toEqual(E.left([`AzureStorage|error - ${name}`]));
  });
});

describe("healthcheck - cosmos db", () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockCosmosClient();
  });

  it("should return no error", async () => {
    const res = await checkAzureCosmosDbHealth("", "")();
    expect(res).toEqual(E.right(true));
  });

  it("should return an error if CosmosClient fails", async () => {
    expect.assertions(1);

    mockGetDatabaseAccount.mockImplementationOnce(mockGetDatabaseAccountKO);

    const res = await checkAzureCosmosDbHealth("", "")();
    expect(res).toEqual(E.left([`AzureCosmosDB|Error calling Cosmos Db`]));
  });
});

describe("healthcheck - url health", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  // todo
  it("should return no error", () => {
    expect(true).toBeTruthy();
  });

  it("should return an error if Url check fails", async () => {
    const res = await checkUrlHealth("")();
    expect(res).toEqual(E.left(["Url|Only absolute URLs are supported"]));
  });
});

describe("checkApplicationHealth - multiple errors - ", () => {
  beforeAll(() => {
    vi.clearAllMocks();
    vi.spyOn(config, "getConfig").mockReturnValue(right(envConfig));

    mockCosmosClient();
  });

  it("should return multiple errors from different checks", async () => {
    const blobServiceKO = getBlobServiceKO("createBlobService");
    const queueServiceKO = getBlobServiceKO("createQueueService");
    createBlobService.mockReturnValueOnce(blobServiceKO);
    createQueueService.mockReturnValueOnce(queueServiceKO);

    const res = await checkApplicationHealth()();
    expect(res).toEqual(
      E.left([
        `AzureStorage|error - createBlobService`,
        `AzureStorage|error - createQueueService`,
        `Url|Only absolute URLs are supported`,
        `Url|Only absolute URLs are supported`
      ])
    );
  });
});
