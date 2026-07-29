import { z } from "zod";

/**
 * Redis host schema: a bare hostname (no scheme, no port).
 */
const HostnameSchema = z
  .string()
  .min(1, "hostname must be non-empty")
  .refine((value) => !value.includes("://"), {
    message:
      "hostname must be a bare hostname without a scheme (the scheme is derived from `enableTls`)",
  })
  .refine((value) => !value.includes(":"), {
    message:
      "hostname must be a bare hostname without a port (the port is derived from `port`)",
  });

/**
 * Runtime schema for {@link createRedisClusterClient}'s config argument.
 *
 * Owns all validation and default values so both the factory and any
 * external caller (env parser, config value-object, integration test)
 * can use the same source of truth:
 *
 * ```ts
 * const config = RedisClusterClientConfigSchema.parse(env);
 * const client = await createRedisClusterClient(config);
 * ```
 */
export const RedisClusterClientConfigSchema = z.object({
  /**
   * Redis host, without scheme or port (e.g. `"cache.example.com"`).
   * The scheme is derived from `enableTls`.
   */
  url: HostnameSchema,

  /**
   * TCP port.
   * Omit to use the default for the selected scheme (6380 for TLS, 6379 for non-TLS).
   */
  port: z.number().int().min(1).max(65535).optional(),

  /**
   * AUTH password. Omit for a passwordless Redis (dev only).
   */
  password: z.string().min(1).optional(),

  /**
   * When `true`, reads are load-balanced across primary and replica nodes.
   */
  useReplicas: z.boolean().default(true),

  /**
   * When `true`, wraps the connection in TLS (`rediss://` scheme).
   */
  enableTls: z.boolean().default(true),

  /**
   * Optional address rewrite table forwarded to
   * `node-redis`'s cluster client. Maps `"host:port"` strings advertised
   * by `CLUSTER NODES` to reachable `{ host, port }` pairs. Useful when
   * the cluster gossips internal addresses the client cannot reach —
   * e.g., a Docker-Compose Redis Cluster on a developer machine, where
   * nodes advertise their `172.18.x.y` addresses and the client is on
   * the host, or a K8s port-forwarded cluster.
   */
  nodeAddressMap: z
    .record(
      z.string(),
      z.object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
      }),
    )
    .optional(),
});

/**
 * Input type: what a caller passes to
 * {@link createRedisClusterClient}. Fields with schema-level defaults
 * (`useReplicas`, `enableTls`) are optional; the factory fills them in.
 */
export type RedisClusterClientConfig = z.input<
  typeof RedisClusterClientConfigSchema
>;

/**
 * Output type: fully-validated, defaults applied. Used internally by
 * the factory after `parse()` and exported for consumers that want to
 * cache a normalized copy.
 */
export type ValidatedRedisClusterClientConfig = z.output<
  typeof RedisClusterClientConfigSchema
>;
