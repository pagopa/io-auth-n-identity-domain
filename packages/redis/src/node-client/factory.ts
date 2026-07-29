import { createClient } from "redis";

import {
  type RedisNodeClientConfig,
  RedisNodeClientConfigSchema,
} from "./config.js";

/**
 * The concrete client type produced by `redis.createClient()`.
 */
export type RedisNodeClient = ReturnType<typeof createClient>;

const DEFAULT_TLS_SCHEME = "rediss://";
const DEFAULT_NON_TLS_SCHEME = "redis://";

const DEFAULT_TLS_PORT = 6380;
const DEFAULT_NON_TLS_PORT = 6379;

const SOCKET_KEEPALIVE_MS = 2000;

const reconnectDelayMs = (attempts: number): number =>
  Math.min(attempts * 50, 1000);

/**
 * Builds and connects a `node-redis` single-node client with sensible
 * defaults for Azure Cache for Redis (non-cluster tier).
 *
 * ```ts
 * const client = await createRedisNodeClient({ url, password });
 * ```
 *
 * @throws Any error thrown by `client.connect()`. The caller decides
 *   whether to retry or fail-fast.
 */
export const createRedisNodeClient = async (
  config: RedisNodeClientConfig,
): Promise<RedisNodeClient> => {
  // Validate and apply schema-level defaults up-front so the rest of
  // the factory can rely on a fully-normalized config.
  const {
    url,
    port: portOverride,
    password,
    enableTls,
  } = RedisNodeClientConfigSchema.parse(config);

  const port =
    portOverride ?? (enableTls ? DEFAULT_TLS_PORT : DEFAULT_NON_TLS_PORT);
  const scheme = enableTls ? DEFAULT_TLS_SCHEME : DEFAULT_NON_TLS_SCHEME;

  const client = createClient({
    legacyMode: false,
    password,
    socket: {
      checkServerIdentity: () => undefined,
      keepAlive: SOCKET_KEEPALIVE_MS,
      reconnectStrategy: reconnectDelayMs,
      tls: enableTls,
    },
    url: `${scheme}${url}:${port}`,
  });

  await client.connect();
  return client;
};
