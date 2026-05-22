import { BlobServiceClient } from "@azure/storage-blob";
import { test as base } from "vitest";
import type { RedisClientType } from "redis";
import { createRedisHarnessClient, findRedisKeysContaining, seedFastLoginNonce, clearBackendTestNonceKeys } from "./redis";
import { readSharedHarnessEnv } from "./shared-harness";

export type BackendTestFixture = {
  readonly clearAuditBlobs: () => Promise<void>;
  readonly findRedisKeysContaining: (
    suffix: string
  ) => Promise<ReadonlyArray<string>>;
  readonly readAuditBlobs: () => Promise<ReadonlyArray<{ body: string; name: string }>>;
  readonly redisClient: RedisClientType;
  readonly seedFastLoginNonce: (nonce: string) => Promise<string>;
};

const createAuditClient = (): BlobServiceClient =>
  BlobServiceClient.fromConnectionString(
    readSharedHarnessEnv().storageConnectionString
  );

const clearAuditBlobs = async (
  blobServiceClient: BlobServiceClient
): Promise<void> => {
  const containerClient = blobServiceClient.getContainerClient(
    readSharedHarnessEnv().auditContainerName
  );

  await containerClient.createIfNotExists();

  for await (const blob of containerClient.listBlobsFlat()) {
    await containerClient.deleteBlob(blob.name);
  }
};

const readAuditBlobs = async (
  blobServiceClient: BlobServiceClient
): Promise<ReadonlyArray<{ body: string; name: string }>> => {
  const containerClient = blobServiceClient.getContainerClient(
    readSharedHarnessEnv().auditContainerName
  );
  const names: Array<string> = [];

  for await (const blob of containerClient.listBlobsFlat()) {
    names.push(blob.name);
  }

  names.sort((left, right) => left.localeCompare(right));

  return Promise.all(
    names.map(async name => ({
      body: (
        await containerClient.getBlockBlobClient(name).downloadToBuffer()
      ).toString("utf8"),
      name
    }))
  );
};

export const backendTest = base.extend<{ backend: BackendTestFixture }>({
  // Vitest fixtures require the first argument to use object destructuring.
  // eslint-disable-next-line no-empty-pattern
  backend: async ({}, use) => {
    const blobServiceClient = createAuditClient();
    const redisClient = await createRedisHarnessClient({
      host: readSharedHarnessEnv().redisHost,
      password: readSharedHarnessEnv().redisPassword,
      port: readSharedHarnessEnv().redisPort
    });

    await clearBackendTestNonceKeys(redisClient);
    await clearAuditBlobs(blobServiceClient);

    try {
      await use({
        clearAuditBlobs: async () => {
          await clearAuditBlobs(blobServiceClient);
        },
        findRedisKeysContaining: suffix =>
          findRedisKeysContaining(redisClient, suffix),
        readAuditBlobs: async () => readAuditBlobs(blobServiceClient),
        redisClient,
        seedFastLoginNonce: nonce => seedFastLoginNonce(redisClient, nonce)
      });
    } finally {
      await clearBackendTestNonceKeys(redisClient);
      await clearAuditBlobs(blobServiceClient);
      await redisClient.disconnect();
    }
  }
});
