import { OperationOptions } from "@azure/core-client";
import {
  CreateTableEntityResponse,
  DeleteTableEntityOptions,
  DeleteTableEntityResponse,
  GetTableEntityOptions,
  ListTableEntitiesOptions,
  RestError,
  TableClient,
  TableEntity,
  TableEntityResult,
  UpdateEntityResponse,
  UpdateTableEntityOptions,
  UpsertEntityResponse,
} from "@azure/data-tables";
import {
  AuthenticationError,
  BadGatewayError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  GenericError,
  GoneError,
  NotFoundError,
  PreconditionFailedError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnprocessableEntityError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import { z } from "zod";

import { TableStorageError } from "./errors.js";

/**
 * A `z.object(...)` describing a full Table Storage row: both the identity
 * (`partitionKey`, `rowKey`) and the payload fields, in a single schema.
 *
 * The constructor enforces at runtime that `partitionKey` and `rowKey` are
 * declared. Any additional fields describe the payload and can be typed as
 * strictly as you like.
 *
 * @example
 * ```ts
 * const SessionSchema = z.object({
 *   partitionKey: NonEmptyStringSchema,
 *   rowKey: NonEmptyStringSchema,
 *   userId: z.string(),
 *   expiresAt: z.number().int().positive(),
 * });
 * ```
 */
export type TableEntitySchema = z.ZodObject<
  {
    partitionKey: z.ZodType<string>;
    rowKey: z.ZodType<string>;
  } & z.core.$ZodLooseShape
>;

/** The `partitionKey` output type declared by the row schema. */
export type PartitionKeyOf<S extends TableEntitySchema> =
  z.output<S>["partitionKey"];

/** The `rowKey` output type declared by the row schema. */
export type RowKeyOf<S extends TableEntitySchema> = z.output<S>["rowKey"];

/**
 * The input type accepted by {@link TableClientWrapper.patchEntity}: keys are
 * required, every payload field is optional.
 */
export type EntityPatchOf<S extends TableEntitySchema> = Pick<
  z.input<S>,
  "partitionKey" | "rowKey"
> &
  Partial<Omit<z.input<S>, "partitionKey" | "rowKey">>;

/**
 * A validated entity together with the Table Storage system metadata
 * (`etag`, `timestamp`) returned on read.
 *
 * The schema shape (`entity`) is kept separate from the metadata so consumers
 * don't have to declare `etag`/`timestamp`/`odata.*` on their zod schemas nor
 * use `.passthrough()` to preserve them.
 *
 * @typeParam T - The domain entity type, typically `z.output<S>`.
 */
export interface TableEntityWithMetadata<T> {
  /** Entity as validated by the bound zod schema. */
  entity: T;
  /** Row etag, suitable for optimistic concurrency on subsequent writes. */
  etag: string;
  /**
   * ISO 8601 timestamp assigned by the service; may be absent when a
   * `select` filter excludes it.
   */
  timestamp?: string;
}

/**
 * Schema-aware, `Result`-returning wrapper around `TableClient`.
 *
 * A single zod `schema` describes the full row (keys + payload). It is used
 * to validate writes before they hit Azure and reads when they come back.
 * Partial updates go through {@link TableClientWrapper.patchEntity}, which
 * uses a derived `schema.partial().required({ partitionKey, rowKey })` and
 * the SDK's `"Merge"` mode.
 *
 * Responsibilities:
 * - Validate every write and every read against the bound schema.
 * - Translate SDK exceptions (`RestError`) and other thrown errors into a
 *   {@link TableStorageError} so callers never `try/catch`.
 * - Preserve Table Storage system metadata (`etag`, `timestamp`) alongside
 *   the validated entity via {@link TableEntityWithMetadata}.
 *
 * The wrapper is intentionally thin: it does not add caching, retries beyond
 * the SDK's defaults, or bulk-write helpers. Use `getTableClient()` to reach
 * the raw `TableClient` if you need something not covered here.
 *
 * @typeParam S - Row schema type; see {@link TableEntitySchema}.
 */
export class TableClientWrapper<S extends TableEntitySchema> {
  protected readonly client: TableClient;
  protected readonly schema: S;
  protected readonly patchSchema: z.ZodObject;

  /**
   * @param client     - Underlying Azure `TableClient`.
   * @param schema     - Zod schema for the full row. Enforced at construction
   *   time to declare both `partitionKey` and `rowKey`.
   *   {@link NotFoundError} messages (e.g. `"Session"`). Defaults to
   *   `"TableEntity"`.
   * @throws Error when `schema` does not declare both `partitionKey` and
   *   `rowKey`.
   */
  constructor(client: TableClient, schema: S) {
    TableClientWrapper.assertSchemaHasKeys(schema);
    this.client = client;
    this.schema = schema;
    // Keys required, payload fields optional — the input shape for patchEntity.
    this.patchSchema = schema.partial().required({
      partitionKey: true,
      rowKey: true,
    });
  }

  /**
   * The row schema must declare both `partitionKey` and `rowKey`.
   */
  private static assertSchemaHasKeys(schema: TableEntitySchema): void {
    const missing: string[] = [];
    if (!("partitionKey" in schema.shape)) missing.push("partitionKey");
    if (!("rowKey" in schema.shape)) missing.push("rowKey");
    if (missing.length > 0) {
      throw new Error(
        `TableClientWrapper: schema is missing required field(s): ${missing.join(
          ", ",
        )}`,
      );
    }
  }

  /**
   * Returns the underlying Azure `TableClient` for operations not exposed by
   * this wrapper (e.g. `createTable`, transactions, SAS generation).
   *
   * Prefer the wrapper methods when they cover your use case.
   */
  public getTableClient(): TableClient {
    return this.client;
  }

  /**
   * Inserts a new entity into the table.
   *
   * Fails with:
   * - `ValidationError` if the entity does not match the schema (client-side
   *   validation or a `400` from the service).
   * - `ConflictError` if a row with the same `partitionKey`/`rowKey` already
   *   exists (HTTP `409`).
   * - Other {@link TableStorageError} variants for the remaining SDK errors.
   *
   * @param entity  - Full row; validated against the schema.
   * @param options - Optional SDK request options.
   */
  public async createEntity(
    entity: z.input<S>,
    options?: OperationOptions,
  ): Promise<Result<CreateTableEntityResponse, TableStorageError>> {
    const validated = this.validateEntity(entity);
    if (validated.isErr()) return err(validated.error);

    try {
      const response = await this.client.createEntity(validated.value, options);
      return ok(response);
    } catch (error) {
      return err(this.handleError(error, "createEntity"));
    }
  }

  /**
   * Reads a single entity by `partitionKey` / `rowKey` and validates it
   * against the bound schema.
   *
   * On success returns the validated entity and the etag/timestamp system
   * metadata (see {@link TableEntityWithMetadata}) so the caller can perform
   * subsequent conditional updates or deletes.
   *
   * Fails with:
   * - `NotFoundError` if the row does not exist (HTTP `404`).
   * - `ValidationError` if the stored row does not match the schema.
   * - Other {@link TableStorageError} variants for the remaining SDK errors.
   *
   * @param partitionKey - Partition key of the target row, typed via `S`.
   * @param rowKey       - Row key of the target row, typed via `S`.
   * @param options      - Optional SDK request options.
   */
  public async getEntity(
    partitionKey: PartitionKeyOf<S>,
    rowKey: RowKeyOf<S>,
    options?: GetTableEntityOptions,
  ): Promise<Result<TableEntityWithMetadata<z.output<S>>, TableStorageError>> {
    let response: TableEntityResult<Record<string, unknown>>;
    try {
      // pk/rk are string subtypes at the type level but TS's index-access
      // through zod's shape widens to `unknown`; cast to satisfy the SDK.
      response = await this.client.getEntity(
        partitionKey as string,
        rowKey as string,
        options,
      );
    } catch (error) {
      return err(this.handleError(error, "getEntity"));
    }
    return this.parseEntity(response, "getEntity");
  }

  /**
   * Replaces an existing row.
   *
   * Uses the SDK's `"Replace"` mode: any pre-existing fields not present in
   * `entity` are removed. For partial updates that preserve other fields,
   * use {@link TableClientWrapper.patchEntity}.
   *
   * Fails with:
   * - `ValidationError` if the entity does not match the schema.
   * - `NotFoundError` if the target row does not exist.
   * - `PreconditionFailedError` if `options.etag` no longer matches.
   * - Other {@link TableStorageError} variants for the remaining SDK errors.
   *
   * @param entity  - Full row; validated against the schema.
   * @param options - Optional SDK request options, including `etag` for
   *   conditional updates.
   */
  public async updateEntity(
    entity: z.input<S>,
    options?: UpdateTableEntityOptions,
  ): Promise<Result<UpdateEntityResponse, TableStorageError>> {
    const validated = this.validateEntity(entity);
    if (validated.isErr()) return err(validated.error);

    try {
      const response = await this.client.updateEntity(
        validated.value,
        "Replace",
        options,
      );
      return ok(response);
    } catch (error) {
      return err(this.handleError(error, "updateEntity"));
    }
  }

  /**
   * Partially updates an existing row: fields present in `patch` overwrite
   * the stored values, fields absent are preserved.
   *
   * `patch` must include `partitionKey` and `rowKey` (they identify the
   * target row); every other schema field is optional and still type-checked
   * when present.
   *
   * Uses the SDK's `"Merge"` mode.
   *
   * Fails with:
   * - `ValidationError` if the patch does not match the schema.
   * - `NotFoundError` if the target row does not exist.
   * - `PreconditionFailedError` if `options.etag` no longer matches.
   * - Other {@link TableStorageError} variants for the remaining SDK errors.
   *
   * @param patch   - Keys plus a partial payload; validated against
   *   `schema.partial().required({ partitionKey, rowKey })`.
   * @param options - Optional SDK request options, including `etag`.
   */
  public async patchEntity(
    patch: EntityPatchOf<S>,
    options?: UpdateTableEntityOptions,
  ): Promise<Result<UpdateEntityResponse, TableStorageError>> {
    const validated = this.validateEntity(patch, true);
    if (validated.isErr()) return err(validated.error);

    try {
      const response = await this.client.updateEntity(
        validated.value,
        "Merge",
        options,
      );
      return ok(response);
    } catch (error) {
      return err(this.handleError(error, "patchEntity"));
    }
  }

  /**
   * Inserts a row if it does not exist, otherwise replaces it.
   *
   * Uses the SDK's `"Replace"` mode. For merge upsert semantics, do a
   * `getEntity` + `patchEntity` (or use `getTableClient().upsertEntity(...)`
   * directly with `"Merge"`).
   *
   * Fails with:
   * - `ValidationError` if the entity does not match the schema.
   * - Other {@link TableStorageError} variants for SDK errors.
   *
   * @param entity  - Full row; validated against the schema.
   * @param options - Optional SDK request options.
   */
  public async upsertEntity(
    entity: z.input<S>,
    options?: OperationOptions,
  ): Promise<Result<UpsertEntityResponse, TableStorageError>> {
    const validated = this.validateEntity(entity);
    if (validated.isErr()) return err(validated.error);

    try {
      const response = await this.client.upsertEntity(
        validated.value,
        "Replace",
        options,
      );
      return ok(response);
    } catch (error) {
      return err(this.handleError(error, "upsertEntity"));
    }
  }

  /**
   * Deletes a single row by `partitionKey` / `rowKey`.
   *
   * Pass `options.etag` to make the delete conditional (optimistic
   * concurrency). Without it, the delete is unconditional (`etag: "*"`).
   *
   * Fails with:
   * - `NotFoundError` if the row does not exist (HTTP `404`).
   * - `PreconditionFailedError` if `options.etag` no longer matches
   *   (HTTP `412`).
   * - Other {@link TableStorageError} variants for the remaining SDK errors.
   *
   * @param partitionKey - Partition key of the target row, typed via `S`.
   * @param rowKey       - Row key of the target row, typed via `S`.
   * @param options      - Optional SDK request options, including `etag`.
   */
  public async deleteEntity(
    partitionKey: PartitionKeyOf<S>,
    rowKey: RowKeyOf<S>,
    options?: DeleteTableEntityOptions,
  ): Promise<Result<DeleteTableEntityResponse, TableStorageError>> {
    try {
      const response = await this.client.deleteEntity(
        partitionKey as string,
        rowKey as string,
        options,
      );
      return ok(response);
    } catch (error) {
      return err(this.handleError(error, "deleteEntity"));
    }
  }

  /**
   * Lazily iterates over the rows in the table, validating each one against
   * the bound schema. Pagination is handled transparently by the underlying
   * SDK iterator.
   *
   * Each iteration yields a `Result`:
   * - `ok({ entity, etag, timestamp })` for rows that pass validation.
   * - `err(ValidationError)` for a single row that fails validation;
   *   iteration continues so a bad row does not stop the whole stream.
   * - `err(TableStorageError)` if the underlying paged request throws; the
   *   generator then terminates.
   *
   * @param options - Optional SDK list options (`queryOptions.filter`,
   *   `queryOptions.select`, `queryOptions.top`, ...).
   *
   * @example
   * ```ts
   * for await (const r of table.listEntities({ queryOptions: { filter } })) {
   *   if (r.isErr()) throw r.error;
   *   handle(r.value.entity);
   * }
   * ```
   */
  public async *listEntities(
    options?: ListTableEntitiesOptions,
  ): AsyncGenerator<
    Result<TableEntityWithMetadata<z.output<S>>, TableStorageError>
  > {
    try {
      for await (const row of this.client.listEntities<Record<string, unknown>>(
        options,
      )) {
        yield this.parseEntity(row, "listEntities");
      }
    } catch (error) {
      yield err(this.handleError(error, "listEntities"));
    }
  }

  /**
   * Validates an entity (or a partial patch) against the bound schema and
   * returns it typed as `TableEntity` (`partitionKey` / `rowKey` presence is
   * guaranteed by the constructor).
   */
  private validateEntity(
    entity: unknown,
    partial: boolean = false,
  ): Result<TableEntity, ValidationError> {
    const schema = partial ? this.patchSchema : this.schema;
    const parsed = schema.safeParse(entity);
    if (!parsed.success) {
      return err(
        new ValidationError(`Invalid entity: ${z.prettifyError(parsed.error)}`),
      );
    }
    return ok(parsed.data as TableEntity);
  }

  /**
   * Validates a row returned by the SDK and attaches its system metadata.
   */
  private parseEntity(
    row: TableEntityResult<Record<string, unknown>>,
    operation: string,
  ): Result<TableEntityWithMetadata<z.output<S>>, TableStorageError> {
    const parsed = this.schema.safeParse(row);
    if (!parsed.success) {
      return err(
        new ValidationError(
          `Invalid entity retrieved (${operation}): ${z.prettifyError(
            parsed.error,
          )}`,
        ),
      );
    }
    return ok({
      entity: parsed.data,
      etag: row.etag,
      timestamp: row.timestamp,
    });
  }

  /**
   * Maps an unknown error thrown by the Azure Table Storage SDK into the
   * appropriate {@link TableStorageError} variant.
   *
   * `RestError`-shaped errors are classified by HTTP `statusCode`:
   * `400 → ValidationError`, `401 → AuthenticationError`,
   * `403 → ForbiddenError`, `404 → NotFoundError`, `409 → ConflictError`,
   * `410 → GoneError`, `412 → PreconditionFailedError`,
   * `422 → UnprocessableEntityError`, `429 → TooManyRequestsError`,
   * `502 → BadGatewayError`, `503 → ServiceUnavailableError`,
   * `504 → GatewayTimeoutError`. Anything unmapped becomes a `GenericError`.
   *
   * Non-`RestError` throwables fall through to `GenericError` with the
   * message (and cause, if any) preserved for diagnostics.
   */
  // eslint-disable-next-line complexity
  private handleError(error: unknown, operation: string): TableStorageError {
    // Duck-type on the SDK's RestError shape rather than `instanceof RestError`.
    // Depending on the package manager and how `@azure/core-rest-pipeline` is
    // hoisted, the RestError class the SDK throws can be a *different* class
    // instance than the one re-exported by `@azure/data-tables` (they still
    // share the same name and shape). Checking `statusCode` is stable across
    // versions and hoisting layouts.
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
    ) {
      const restErr = error as RestError;
      const detail = `${operation} failed (code=${
        restErr.code ?? "unknown"
      }, status=${restErr.statusCode ?? "unknown"}): ${restErr.message}`;

      switch (restErr.statusCode) {
        case 400:
          return new ValidationError(detail);
        case 401:
          return new AuthenticationError();
        case 403:
          return new ForbiddenError();
        case 404:
          return new NotFoundError(this.client.tableName, detail);
        case 409:
          return new ConflictError(detail);
        case 410:
          return new GoneError(detail);
        case 412:
          return new PreconditionFailedError(detail);
        case 422:
          return new UnprocessableEntityError(detail);
        case 429:
          return new TooManyRequestsError();
        case 502:
          return new BadGatewayError(detail);
        case 503:
          return new ServiceUnavailableError(detail);
        case 504:
          return new GatewayTimeoutError(detail);
        default:
          return new GenericError(detail);
      }
    }

    if (error instanceof Error) {
      const causeMsg =
        error.cause instanceof Error
          ? error.cause.message
          : error.cause !== undefined && typeof error.cause === "object"
            ? JSON.stringify(error.cause)
            : error.cause !== undefined
              ? // eslint-disable-next-line @typescript-eslint/no-base-to-string
                String(error.cause)
              : "";
      const cause = causeMsg ? ` Caused by: ${causeMsg}` : "";
      const message = `${operation} failed: ${error.message}${cause}`;
      return new GenericError(message);
    }

    return new GenericError(`${operation} failed: ${String(error)}`);
  }
}
