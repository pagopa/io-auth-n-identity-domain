import { ValidationError } from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";
import type { RedisClusterType, RedisClientType } from "redis";
import { z } from "zod";

import { RedisError, toRedisError } from "../errors.js";

/**
 * `Result`-returning wrapper over a `redis` client for storing and
 * retrieving JSON-serializable objects under a single String key,
 * generic in the schema of the stored value.
 *
 * The value is serialized to (and deserialized from) its JSON wire
 * form with `JSON.stringify`/`JSON.parse`; the bound zod schema
 * validates the value both before `SET` and after `GET`, so a
 * corrupted or unexpectedly-shaped payload surfaces as a
 * `ValidationError`
 *
 * @typeParam TSchema - Any zod schema describing the stored value.
 * @typeParam TClient - Concrete client type. Inferred from the value
 *   passed to the constructor; defaults to the topology-agnostic
 *   union {@link RedisObjectClient}.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * const wrapper = new RedisObjectWrapper(client, UserSchema);
 * await wrapper.save("USER-1", { id: "1", name: "Ada" });
 * const stored = await wrapper.get("USER-1");
 * ```
 */
export class RedisObjectWrapper<
  TSchema extends z.ZodType = z.ZodType,
  TClient extends RedisClientType | RedisClusterType =
    | RedisClientType
    | RedisClusterType,
> {
  constructor(
    protected readonly client: TClient,
    protected readonly valueSchema: TSchema,
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
   * [`SET`](https://redis.io/commands/set/) - `O(1)`.
   * Validates `value` against the bound schema, serializes it to JSON
   * and stores it at `key`.
   *
   * Invalid input short-circuits with a `ValidationError` and no `SET`
   * is sent.
   */
  public async save(
    key: string,
    value: z.output<TSchema>,
  ): Promise<Result<void, RedisError | ValidationError>> {
    const encoded = this.encode(value);
    if (encoded.isErr()) {
      return err(encoded.error);
    }

    try {
      await this.client.set(key, encoded.value);
      return ok(undefined);
    } catch (cause) {
      return err(toRedisError(`SET ${key}`, cause));
    }
  }

  /**
   * [`GET`](https://redis.io/commands/get/) - `O(1)`.
   * Retrieves the value stored at `key`, parses it as JSON and
   * validates it against the bound schema.
   *
   * Resolves to `undefined` when the key doesn't exist. A malformed
   * JSON payload or a value that doesn't match the schema surfaces as
   * a `ValidationError`.
   */
  public async get(
    key: string,
  ): Promise<
    Result<z.output<TSchema> | undefined, RedisError | ValidationError>
  > {
    let raw: null | string;
    try {
      raw = await this.client.get(key);
    } catch (cause) {
      return err(toRedisError(`GET ${key}`, cause));
    }

    if (raw === null) {
      return ok(undefined);
    }

    let deserialized: unknown;
    try {
      deserialized = JSON.parse(raw);
    } catch {
      return err(
        new ValidationError(`Couldn't parse JSON value for key "${key}"`),
      );
    }

    const parsed = this.valueSchema.safeParse(deserialized);
    if (!parsed.success) {
      return err(
        new ValidationError(
          `Invalid stored value for key "${key}": ${z.prettifyError(parsed.error)}`,
        ),
      );
    }

    return ok(parsed.data);
  }

  private encode(object: z.output<TSchema>): Result<string, ValidationError> {
    const result = z.safeEncode(this.valueSchema, object);
    if (!result.success) {
      return err(
        new ValidationError(
          `Invalid Set member: ${z.prettifyError(result.error)}`,
        ),
      );
    }
    return ok(JSON.stringify(result.data));
  }
}
