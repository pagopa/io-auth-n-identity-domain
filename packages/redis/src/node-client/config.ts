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
 * Runtime schema for {@link createRedisNodeClient}'s
 * and {@link createRedisManagedIdentityNodeClient}'s config argument.
 *
 * ```ts
 * const config = RedisNodeClientConfigSchema.parse(env);
 * const client = await createRedisNodeClient(config);
 * ```
 */
export const RedisNodeClientConfigSchema = z.object({
  /**
   * Redis host, without scheme or port (e.g. `"cache.example.com"`).
   * The scheme is derived from `enableTls`.
   */
  hostname: HostnameSchema,

  /**
   * TCP port.
   * Omit to use the default for the selected scheme (6380 for TLS, 6379 for non-TLS).
   */
  port: z.number().int().min(1).max(65535).optional(),

  /**
   * When `true`, wraps the connection in TLS (`rediss://` scheme).
   */
  enableTls: z.boolean().default(true),
});

export type RedisNodeClientConfig = z.input<typeof RedisNodeClientConfigSchema>;

/**
 * Runtime schema for {@link createRedisNodeClient}'s config argument:
 * a specialization of {@link RedisNodeClientConfigSchema} that also
 * accepts an AUTH password.
 *
 * ```ts
 * const config = RedisPasswordNodeClientConfigSchema.parse(env);
 * const client = await createRedisNodeClient(config);
 * ```
 */
export const RedisPasswordNodeClientConfigSchema =
  RedisNodeClientConfigSchema.extend({
    /**
     * AUTH password. Omit for a passwordless Redis (dev only).
     */
    password: z.string().min(1).optional(),
  });

export type RedisPasswordNodeClientConfig = z.input<
  typeof RedisPasswordNodeClientConfigSchema
>;
