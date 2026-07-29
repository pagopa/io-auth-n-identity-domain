import { createCluster } from "redis";

import {
  type RedisClusterClientConfig,
  RedisClusterClientConfigSchema,
} from "./config.js";

/**
 * The concrete client type produced by `redis.createCluster()`.
 *
 * We derive this from the function itself rather than importing
 * `RedisClusterType` from `redis` because the alias resolves to slightly
 * different concrete types depending on how `@redis/client` is hoisted
 * (the workspace can end up with two `RedisClusterType` symbols that
 * TypeScript considers unrelated). Using `ReturnType` guarantees the
 * returned client always matches what `createCluster()` actually
 * produces.
 */
export type RedisClusterClient = ReturnType<typeof createCluster>;

const DEFAULT_TLS_SCHEME = "rediss://";
const DEFAULT_NON_TLS_SCHEME = "redis://";

const DEFAULT_TLS_PORT = 6380;
const DEFAULT_NON_TLS_PORT = 6379;

const KEEPALIVE_PING_INTERVAL_MS = 1000 * 60 * 9;
const SOCKET_KEEPALIVE_MS = 2000;

const reconnectDelayMs = (attempts: number): number =>
  Math.min(attempts * 50, 1000);

/**
 * Builds and connects a `node-redis` cluster client with sensible
 * defaults for Azure Cache for Redis Cluster.
 *
 * Two connections (fast + safe) can be built by calling this twice with
 * different `useReplicas` values:
 *
 * ```ts
 * const fast = await createRedisClusterClient({ url, password, useReplicas: true });
 * const safe = await createRedisClusterClient({ url, password, useReplicas: false });
 * ```
 *
 * @throws Any error thrown by `client.connect()`. The caller decides
 *   whether to retry or fail-fast.
 */
export const createRedisClusterClient = async (
  config: RedisClusterClientConfig,
): Promise<RedisClusterClient> => {
  // Validate and apply schema-level defaults up-front so the rest of
  // the factory can rely on a fully-normalized config.
  const {
    url,
    port: portOverride,
    password,
    useReplicas,
    enableTls,
    nodeAddressMap,
  } = RedisClusterClientConfigSchema.parse(config);

  const port =
    portOverride ?? (enableTls ? DEFAULT_TLS_PORT : DEFAULT_NON_TLS_PORT);
  const scheme = enableTls ? DEFAULT_TLS_SCHEME : DEFAULT_NON_TLS_SCHEME;

  const rootNodeUrl = `${scheme}${url}:${port}`;

  const client = createCluster({
    defaults: {
      legacyMode: false,
      password,
      pingInterval: KEEPALIVE_PING_INTERVAL_MS,
      socket: {
        checkServerIdentity: () => undefined,
        keepAlive: SOCKET_KEEPALIVE_MS,
        reconnectStrategy: reconnectDelayMs,
        tls: enableTls,
      },
    },
    rootNodes: [{ url: rootNodeUrl }],
    useReplicas,
    nodeAddressMap,
  });

  await client.connect();
  return client;
};
