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
 * Runtime schema for {@link createRedisNodeClient}'s config argument.
 *
 * Owns all validation and default values so both the factory and any
 * external caller (env parser, config value-object, integration test)
 * can use the same source of truth:
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
   * When `true`, wraps the connection in TLS (`rediss://` scheme).
   */
  enableTls: z.boolean().default(true),
});

/**
 * Input type: what a caller passes to {@link createRedisNodeClient}.
 * Fields with schema-level defaults (`enableTls`) are optional; the
 * factory fills them in.
 */
export type RedisNodeClientConfig = z.input<typeof RedisNodeClientConfigSchema>;

/**
 * Output type: fully-validated, defaults applied. Used internally by
 * the factory after `parse()` and exported for consumers that want to
 * cache a normalized copy.
 */
export type ValidatedRedisNodeClientConfig = z.output<
  typeof RedisNodeClientConfigSchema
>;
