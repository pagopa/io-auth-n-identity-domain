/**
 * Local Redis Cluster connection details.
 */
export const REDIS_URL = process.env.REDIS_URL ?? "localhost";
export const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? "bitnami";
export const REDIS_TLS_ENABLED = process.env.REDIS_TLS_ENABLED === "true";

/**
 * Local Redis standalone (single-node) connection details.
 *
 * Points at the `redis-standalone` service from `docker-compose.yml`
 * (defaulted to port 6378, password "foo", no TLS — matching
 * `docker/.env.common.example`).
 */
export const REDIS_STANDALONE_URL =
  process.env.REDIS_STANDALONE_URL ?? "localhost";
export const REDIS_STANDALONE_PORT = Number(
  process.env.REDIS_STANDALONE_PORT ?? 6378,
);
export const REDIS_STANDALONE_PASSWORD =
  process.env.REDIS_STANDALONE_PASSWORD ?? "foo";
export const REDIS_STANDALONE_TLS_ENABLED =
  process.env.REDIS_STANDALONE_TLS_ENABLED === "true";

/**
 * Rewrite table for the Docker-Compose Redis Cluster shipped in
 * `docker-compose.yml`. The cluster gossips its own containers'
 * `172.18.x.y` network IPs, which are unreachable from the host —
 * so we rewrite them to `127.0.0.1:<published-host-port>`, matching
 * the `ports:` mappings in the compose file.
 *
 * The IPs come from the static `ipv4_address` assignments on each
 * `redis-node-*` and `redis-cluster` service (172.18.0.99 for the
 * cluster entry, 172.18.0.100–105 for the six nodes).
 *
 * Not needed against real cloud clusters (Azure Cache for Redis
 * Cluster advertises reachable addresses out of the box).
 */
export const LOCAL_DOCKER_NODE_ADDRESS_MAP: Record<
  string,
  { host: string; port: number }
> = {
  "172.18.0.99:6379": { host: "127.0.0.1", port: 6379 },
  "172.18.0.100:6380": { host: "127.0.0.1", port: 6380 },
  "172.18.0.101:6381": { host: "127.0.0.1", port: 6381 },
  "172.18.0.102:6382": { host: "127.0.0.1", port: 6382 },
  "172.18.0.103:6383": { host: "127.0.0.1", port: 6383 },
  "172.18.0.104:6384": { host: "127.0.0.1", port: 6384 },
  "172.18.0.105:6385": { host: "127.0.0.1", port: 6385 },
};
