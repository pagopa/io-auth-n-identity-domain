import { type TokenCredential } from "@azure/identity";
import {
  EntraIdCredentialsProviderFactory,
  REDIS_SCOPE_DEFAULT,
} from "@redis/entraid";
import { createClient, type RedisClientType } from "redis";

import {
  type RedisNodeClientConfig,
  RedisNodeClientConfigSchema,
  type RedisPasswordNodeClientConfig,
  RedisPasswordNodeClientConfigSchema,
} from "./config.js";

/**
 * The concrete client type produced by `redis.createClient()`.
 */
export type RedisNodeClient = RedisClientType;

const DEFAULT_TLS_SCHEME = "rediss://";
const DEFAULT_NON_TLS_SCHEME = "redis://";

const DEFAULT_TLS_PORT = 6380;
const DEFAULT_NON_TLS_PORT = 6379;

const SOCKET_KEEPALIVE_MS = 2000;

const reconnectDelayMs = (attempts: number): number =>
  Math.min(attempts * 50, 1000);

const getRedisPort = (
  portOverride: number | undefined,
  enableTls: boolean,
): number =>
  portOverride ?? (enableTls ? DEFAULT_TLS_PORT : DEFAULT_NON_TLS_PORT);

const getRedisScheme = (enableTls: boolean): string =>
  enableTls ? DEFAULT_TLS_SCHEME : DEFAULT_NON_TLS_SCHEME;

/**
 * Builds and connects a `node-redis` single-node client with sensible defaults.
 *
 * ```ts
 * const client = await createRedisNodeClient({ hostname, password });
 * ```
 *
 * @throws Any error thrown by `client.connect()`. The caller decides
 *   whether to retry or fail-fast.
 */
export const createRedisNodeClient = async (
  config: RedisPasswordNodeClientConfig,
): Promise<RedisNodeClient> => {
  const {
    hostname,
    port: portOverride,
    password,
    enableTls,
  } = RedisPasswordNodeClientConfigSchema.parse(config);

  const port = getRedisPort(portOverride, enableTls);
  const scheme = getRedisScheme(enableTls);

  const socket = enableTls
    ? {
        tls: true as const,
        // TODO: from a [Github Copilot's comment in a Pull Request review](https://github.com/pagopa/io-auth-n-identity-domain/pull/764#discussion_r3675124646)
        // checkServerIdentity: () => undefined disables TLS server identity verification, which can allow MITM when enableTls is true.
        checkServerIdentity: () => undefined,
        keepAlive: true,
        keepAliveInitialDelay: SOCKET_KEEPALIVE_MS,
        reconnectStrategy: reconnectDelayMs,
      }
    : {
        tls: false as const,
        keepAlive: true,
        keepAliveInitialDelay: SOCKET_KEEPALIVE_MS,
        reconnectStrategy: reconnectDelayMs,
      };

  const client = createClient({
    password,
    socket,
    url: `${scheme}${hostname}:${port}`,
  });

  await client.connect();
  return client;
};

/**
 * Builds and connects a `node-redis` single-node client with sensible defaults,
 * using an Azure Managed Identity to authenticate to the Redis server.
 *
 * ```ts
 * const client = await createRedisManagedIdentityNodeClient({ hostname }, credential);
 * ```
 *
 * @throws Any error thrown by `client.connect()`. The caller decides
 *   whether to retry or fail-fast.
 */
export const createRedisManagedIdentityNodeClient = async (
  config: RedisNodeClientConfig,
  credential: TokenCredential,
): Promise<RedisNodeClient> => {
  const {
    hostname,
    port: portOverride,
    enableTls,
  } = RedisNodeClientConfigSchema.parse(config);

  const provider =
    EntraIdCredentialsProviderFactory.createForDefaultAzureCredential({
      credential,
      scopes: REDIS_SCOPE_DEFAULT,
      options: {},
      tokenManagerConfig: {
        expirationRefreshRatio: 0.8,
      },
    });

  const port = getRedisPort(portOverride, enableTls);
  const scheme = getRedisScheme(enableTls);

  const socket = enableTls
    ? {
        tls: true as const,
        checkServerIdentity: () => undefined,
        keepAlive: true,
        keepAliveInitialDelay: SOCKET_KEEPALIVE_MS,
        reconnectStrategy: reconnectDelayMs,
      }
    : {
        tls: false as const,
        keepAlive: true,
        keepAliveInitialDelay: SOCKET_KEEPALIVE_MS,
        reconnectStrategy: reconnectDelayMs,
      };

  const client = createClient({
    socket,
    url: `${scheme}${hostname}:${port}`,
    credentialsProvider: provider,
  });

  await client.connect();
  return client;
};
