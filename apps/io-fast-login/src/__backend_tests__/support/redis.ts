import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { createClient, type RedisClientType } from "redis";
import { nonceRedisKey } from "./fixtures";

/**
 * Boots the real Redis dependency for backend tests and exposes local read/write helpers.
 */
export type RedisHarness = {
  readonly host: string;
  readonly password: string;
  readonly port: number;
  readonly stop: () => Promise<void>;
};

export type RedisConnectionConfig = {
  readonly host: string;
  readonly password: string;
  readonly port: number;
};

const redisImage = "redis:6.0-alpine";

const waitForRedis = async (
  connection: RedisConnectionConfig
): Promise<void> => {
  const client = await createRedisHarnessClient(connection);

  try {
    await client.ping();
  } finally {
    await client.disconnect();
  }
};

export const createRedisHarnessClient = async ({
  host,
  password,
  port
}: RedisConnectionConfig): Promise<RedisClientType> => {
  const client = createClient({
    password,
    url: `redis://${host}:${port}`
  });

  await client.connect();

  return client;
};

export const clearBackendTestNonceKeys = async (
  client: RedisClientType
): Promise<void> => {
  const keys = await client.keys("FNFASTLOGIN-NONCE-*");

  if (keys.length > 0) {
    await client.del(keys);
  }
};

export const seedFastLoginNonce = async (
  client: RedisClientType,
  nonce: string
): Promise<string> => {
  const key = nonceRedisKey(nonce);
  await client.setEx(key, 60, "");
  return key;
};

export const findRedisKeysContaining = async (
  client: RedisClientType,
  suffix: string
): Promise<ReadonlyArray<string>> =>
  (await client.keys(`*${suffix}`)).sort((left, right) =>
    left.localeCompare(right)
  );

export const startRedisHarness = async (
  password: string
): Promise<RedisHarness> => {
  const container: StartedTestContainer = await new GenericContainer(redisImage)
    .withCommand(["redis-server", "--requirepass", password])
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();

  const harness = {
    host: container.getHost(),
    password,
    port: container.getMappedPort(6379),
    stop: async () => {
      await container.stop();
    }
  } satisfies RedisHarness;

  await waitForRedis(harness);

  return harness;
};
