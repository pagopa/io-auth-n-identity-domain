/**
 * Local Redis standalone (single-node) connection details.
 *
 * Points at the `redis-standalone` service from `docker-compose.yml`
 * (defaulted to port 6378, password "foo", no TLS — matching
 * `docker/.env.common.example`).
 */
export const REDIS_STANDALONE_HOSTNAME =
  process.env.REDIS_STANDALONE_HOSTNAME ?? "localhost";
export const REDIS_STANDALONE_PORT = Number(
  process.env.REDIS_STANDALONE_PORT ?? 6378,
);
export const REDIS_STANDALONE_PASSWORD =
  process.env.REDIS_STANDALONE_PASSWORD ?? "foo";
export const REDIS_STANDALONE_TLS_ENABLED =
  process.env.REDIS_STANDALONE_TLS_ENABLED === "true";
