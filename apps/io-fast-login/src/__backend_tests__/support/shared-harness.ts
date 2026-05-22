import { startAzuriteHarness, type AzuriteHarness } from "./azurite";
import { fastLoginAuditContainerName, functionsMasterKey } from "./fixtures";
import { startRedisHarness, type RedisHarness } from "./redis";

const backendEnvNames = {
  auditContainerName: "IO_FAST_LOGIN_BACKEND_AUDIT_CONTAINER_NAME",
  functionsMasterKey: "IO_FAST_LOGIN_BACKEND_FUNCTIONS_MASTER_KEY",
  redisHost: "IO_FAST_LOGIN_BACKEND_REDIS_HOST",
  redisPassword: "IO_FAST_LOGIN_BACKEND_REDIS_PASSWORD",
  redisPort: "IO_FAST_LOGIN_BACKEND_REDIS_PORT",
  storageConnectionString: "IO_FAST_LOGIN_BACKEND_STORAGE_CONNECTION_STRING"
} as const;

type BackendEnvKey = keyof typeof backendEnvNames;

export type SharedHarness = {
  readonly azurite: AzuriteHarness;
  readonly redis: RedisHarness;
  readonly stop: () => Promise<void>;
};

export type SharedHarnessEnv = {
  readonly auditContainerName: string;
  readonly functionsMasterKey: string;
  readonly redisHost: string;
  readonly redisPassword: string;
  readonly redisPort: number;
  readonly storageConnectionString: string;
};

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing backend-test environment value: ${name}`);
  }

  return value;
};

const envEntry = (key: BackendEnvKey): string => backendEnvNames[key];

export const readSharedHarnessEnv = (): SharedHarnessEnv => ({
  auditContainerName: readRequiredEnv(envEntry("auditContainerName")),
  functionsMasterKey: readRequiredEnv(envEntry("functionsMasterKey")),
  redisHost: readRequiredEnv(envEntry("redisHost")),
  redisPassword: readRequiredEnv(envEntry("redisPassword")),
  redisPort: Number.parseInt(readRequiredEnv(envEntry("redisPort")), 10),
  storageConnectionString: readRequiredEnv(envEntry("storageConnectionString"))
});

export const applySharedHarnessEnv = (harness: SharedHarness): void => {
  process.env[envEntry("auditContainerName")] = fastLoginAuditContainerName;
  process.env[envEntry("functionsMasterKey")] = functionsMasterKey;
  process.env[envEntry("redisHost")] = harness.redis.host;
  process.env[envEntry("redisPassword")] = harness.redis.password;
  process.env[envEntry("redisPort")] = String(harness.redis.port);
  process.env[envEntry("storageConnectionString")] =
    harness.azurite.connectionString;
};

export const startSharedHarness = async (): Promise<SharedHarness> => {
  const [redis, azurite] = await Promise.all([
    startRedisHarness("io-fast-login-backend-tests-password"),
    startAzuriteHarness()
  ]);

  await azurite.ensureAuditContainer();

  return {
    azurite,
    redis,
    stop: async () => {
      await azurite.stop();
      await redis.stop();
    }
  };
};
