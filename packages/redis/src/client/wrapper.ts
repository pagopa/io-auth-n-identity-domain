import { ValidationError } from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import type { createClient, createCluster } from "redis";
import { z } from "zod";

import { RedisError, toRedisError } from "./errors.js";

/**
 * The concrete `redis` single-node client shape accepted by
 * {@link RedisSetWrapper}.
 */
export type RedisNodeClient = ReturnType<typeof createClient>;

/**
 * The concrete `redis` cluster client shape accepted by
 * {@link RedisSetWrapper}.
 */
export type RedisClusterClient = ReturnType<typeof createCluster>;

/**
 * Any `node-redis` client that exposes the Set-command surface
 * ({@link RedisSetWrapper} only touches `SISMEMBER`, `SADD`, `SREM`).
 * Both single-node and cluster clients qualify.
 */
export type RedisSetClient = RedisClusterClient | RedisNodeClient;

/**
 * `Result`-returning wrapper over a `redis` client for **Set
 * operations**, generic in the schema of the members.
 *
 * The wrapper is constructed with a `zod` schema that describes what a
 * valid Set member looks like. Every write and read is defensively
 * re-validated against the schema before it hits Redis — TypeScript
 * narrows the input to `z.output<TSchema>` at compile time.
 *
 * The wrapper is topology-agnostic: it accepts either a single-node
 * client (`createClient()`) or a cluster client (`createCluster()`).
 * The concrete client type is preserved through the `TClient` generic
 * so callers that use {@link RedisSetWrapper.getClient} for
 * topology-specific commands keep full type information.
 *
 * @typeParam TSchema - Zod schema whose output describes the domain
 *   type of the Set members.
 * @typeParam TClient - Concrete client type. Inferred from the value
 *   passed to the constructor; defaults to the topology-agnostic
 *   union {@link RedisSetClient}.
 *
 * @example
 * ```ts
 * import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
 *
 * const wrapper = new RedisSetWrapper(client, FiscalCodeSchema);
 * await wrapper.add("BLOCKEDUSERS", fiscalCode);
 * ```
 */
export class RedisSetWrapper<
  TSchema extends z.ZodType<string> = z.ZodType<string>,
  TClient extends RedisSetClient = RedisSetClient,
> {
  constructor(
    protected readonly client: TClient,
    protected readonly memberSchema: TSchema,
  ) {}

  /**
   * Returns the underlying `redis` client for commands not covered by
   * this wrapper. The concrete client type (single-node or cluster) is
   * preserved from construction.
   */
  public getClient(): TClient {
    return this.client;
  }

  /**
   * [`SISMEMBER`](https://redis.io/commands/sismember/) — `O(1)`.
   * Returns `true` when `member` belongs to the Set stored at `key`.
   *
   * The member is validated against the bound schema before the
   * server round-trip; invalid input short-circuits with a
   * `ValidationError`.
   */
  public async isMember(
    key: string,
    member: z.output<TSchema>,
  ): Promise<Result<boolean, RedisError | ValidationError>> {
    const parsed = this.parseMember(member);
    if (parsed.isErr()) return err(parsed.error);

    try {
      const isMember = await this.client.sIsMember(key, parsed.value);
      return ok(isMember);
    } catch (cause) {
      return err(toRedisError(`SISMEMBER ${key}`, cause));
    }
  }

  /**
   * [`SADD`](https://redis.io/commands/sadd/) — `O(1)` per member.
   * Idempotent: already-present members contribute `0` to the count.
   *
   * Every member (single or array) is validated against the bound
   * schema before the server round-trip; the first invalid entry
   * short-circuits with a `ValidationError` and no `SADD` is sent.
   *
   * @returns Number of members that were **newly** added.
   */
  public async add(
    key: string,
    members: z.output<TSchema> | z.output<TSchema>[],
  ): Promise<Result<number, RedisError | ValidationError>> {
    const parsed = this.parseMembers(members);
    if (parsed.isErr()) return err(parsed.error);

    try {
      const added = await this.client.sAdd(key, parsed.value);
      return ok(added);
    } catch (cause) {
      return err(toRedisError(`SADD ${key}`, cause));
    }
  }

  /**
   * [`SREM`](https://redis.io/commands/srem/) — `O(1)` per member.
   * Idempotent: absent members contribute `0` to the count.
   *
   * Every member (single or array) is validated against the bound
   * schema before the server round-trip; the first invalid entry
   * short-circuits with a `ValidationError` and no `SREM` is sent.
   *
   * @returns Number of members that were **actually** removed.
   */
  public async rem(
    key: string,
    members: z.output<TSchema> | z.output<TSchema>[],
  ): Promise<Result<number, RedisError | ValidationError>> {
    const parsed = this.parseMembers(members);
    if (parsed.isErr()) return err(parsed.error);

    try {
      const removed = await this.client.sRem(key, parsed.value);
      return ok(removed);
    } catch (cause) {
      return err(toRedisError(`SREM ${key}`, cause));
    }
  }

  /**
   * Parses a single member through the schema.
   */
  private parseMember(
    member: z.output<TSchema>,
  ): Result<z.output<TSchema>, ValidationError> {
    const result = this.memberSchema.safeParse(member);
    if (!result.success) {
      return err(
        new ValidationError(
          `Invalid Set member: ${z.prettifyError(result.error)}`,
        ),
      );
    }
    return ok(result.data);
  }

  /**
   * Parses a single member or an array of members, preserving the
   * shape so `sAdd`/`sRem` receive a `string` for a single member and
   * `string[]` for an array.
   */
  private parseMembers(
    members: z.output<TSchema> | z.output<TSchema>[],
  ): Result<z.output<TSchema> | z.output<TSchema>[], ValidationError> {
    if (!Array.isArray(members)) {
      return this.parseMember(members);
    }

    const parsed: z.output<TSchema>[] = [];
    for (const m of members) {
      const result = this.parseMember(m);
      if (result.isErr()) return err(result.error);
      parsed.push(result.value);
    }
    return ok(parsed);
  }
}
