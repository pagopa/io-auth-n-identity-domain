import { ValidationError } from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";
import type { RedisClientType, RedisClusterType } from "redis";
import { z } from "zod";

import { RedisError, toRedisError } from "./errors.js";

/**
 * The concrete `redis` single-node client shape accepted by
 * {@link RedisSetWrapper}.
 */
export type RedisNodeClient = RedisClientType;

/**
 * The concrete `redis` cluster client shape accepted by
 * {@link RedisSetWrapper}.
 */
export type RedisClusterClient = RedisClusterType;

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
 * The wrapper is topology-agnostic: it accepts either a single-node
 * client (`createClient()`) or a cluster client (`createCluster()`).
 * The concrete client type is preserved through the `TClient` generic
 * so callers that use {@link RedisSetWrapper.getClient} for
 * topology-specific commands keep full type information.
 *
 * @typeParam TSchema - Any zod schema whose input (wire form) is a
 *   string. The output (domain form) is free.
 * @typeParam TClient - Concrete client type. Inferred from the value
 *   passed to the constructor; defaults to the topology-agnostic
 *   union {@link RedisSetClient}.
 *
 * @example
 * ```ts
 * import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
 * // Identity codec: domain `FiscalCode`, wire `string`.
 * const wrapper = new RedisSetWrapper(client, FiscalCodeSchema);
 * await wrapper.add("BLOCKEDUSERS", fiscalCode);
 * ```
 *
 * @example
 * ```ts
 * // Non-identity codec: domain `Date`, wire ISO string.
 * const TimestampCodec = z.codec(
 *   z.iso.datetime(),
 *   z.date(),
 *   { decode: iso => new Date(iso), encode: date => date.toISOString() },
 * );
 * const wrapper = new RedisSetWrapper(client, TimestampCodec);
 * await wrapper.add("SEEN", new Date()); // stored as ISO string
 * ```
 */

export class RedisSetWrapper<
  TSchema extends z.ZodType<unknown, string> = z.ZodType<unknown, string>,
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
   * The member is encoded through the bound schema before the server
   * round-trip; invalid input short-circuits with a `ValidationError`.
   */
  public async isMember(
    key: string,
    member: z.output<TSchema>,
  ): Promise<Result<boolean, RedisError | ValidationError>> {
    const encoded = this.encodeMember(member);
    if (encoded.isErr()) return err(encoded.error);

    try {
      const isMember = await this.client.sIsMember(key, encoded.value);
      return ok(isMember === 1);
    } catch (cause) {
      return err(toRedisError(`SISMEMBER ${key}`, cause));
    }
  }

  /**
   * [`SADD`](https://redis.io/commands/sadd/) — `O(1)` per member.
   * Idempotent: already-present members contribute `0` to the count.
   *
   * Every member (single or array) is encoded through the bound
   * schema before the server round-trip; the first invalid entry
   * short-circuits with a `ValidationError` and no `SADD` is sent.
   *
   * @returns Number of members that were **newly** added.
   */
  public async add(
    key: string,
    members: z.output<TSchema> | z.output<TSchema>[],
  ): Promise<Result<number, RedisError | ValidationError>> {
    const encoded = this.encodeMembers(members);
    if (encoded.isErr()) return err(encoded.error);

    try {
      const added = await this.client.sAdd(key, encoded.value);
      return ok(added);
    } catch (cause) {
      return err(toRedisError(`SADD ${key}`, cause));
    }
  }

  /**
   * [`SREM`](https://redis.io/commands/srem/) — `O(1)` per member.
   * Idempotent: absent members contribute `0` to the count.
   *
   * Every member (single or array) is encoded through the bound
   * schema before the server round-trip; the first invalid entry
   * short-circuits with a `ValidationError` and no `SREM` is sent.
   *
   * @returns Number of members that were **actually** removed.
   */
  public async rem(
    key: string,
    members: z.output<TSchema> | z.output<TSchema>[],
  ): Promise<Result<number, RedisError | ValidationError>> {
    const encoded = this.encodeMembers(members);
    if (encoded.isErr()) return err(encoded.error);

    try {
      const removed = await this.client.sRem(key, encoded.value);
      return ok(removed);
    } catch (cause) {
      return err(toRedisError(`SREM ${key}`, cause));
    }
  }

  /**
   * Encodes a single domain member into its wire form via the schema.
   */
  private encodeMember(
    member: z.output<TSchema>,
  ): Result<z.input<TSchema>, ValidationError> {
    const result = z.safeEncode(this.memberSchema, member);
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
   * Encodes a single member or an array of members, preserving the
   * shape so `sAdd`/`sRem` receive a single wire value for a single
   * member and an array for an array.
   *
   * An empty array short-circuits with a `ValidationError` — sending
   * `SADD KEY` (with no members) to Redis makes the server reply with
   * "ERR wrong number of arguments", which surfaces to the caller as
   * a confusing `GenericError`. Rejecting at the wrapper layer keeps
   * the mistake attributable to the caller's input.
   */
  private encodeMembers(
    members: z.output<TSchema> | z.output<TSchema>[],
  ): Result<z.input<TSchema> | z.input<TSchema>[], ValidationError> {
    if (!Array.isArray(members)) {
      return this.encodeMember(members);
    }

    if (members.length === 0) {
      return err(new ValidationError("members array must be non-empty"));
    }

    const encoded: z.input<TSchema>[] = [];
    for (const m of members) {
      const result = this.encodeMember(m);
      if (result.isErr()) return err(result.error);
      encoded.push(result.value);
    }
    return ok(encoded);
  }
}
