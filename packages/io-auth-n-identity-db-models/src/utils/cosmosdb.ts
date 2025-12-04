import {
  Container,
  ItemDefinition,
  OperationInput,
  OperationResponse,
} from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  ConflictError,
  DecodeError,
  GenericError,
  NotFoundError,
  toConflictError,
  toDecodeError,
  toGenericError,
  toNotFoundError,
} from "./errors";

export type AzureCosmosResource = t.TypeOf<typeof AzureCosmosResource>;
export const AzureCosmosResource = t.type({
  _etag: t.string,
  _rid: t.string,
  _self: t.string,
  _ts: t.number,
});

export const Ttl = t.type({
  ttl: NonNegativeInteger,
});
export type Ttl = t.TypeOf<typeof Ttl>;

export const performPointRead =
  <ID extends string, PK extends string>(deps: { container: Container }) =>
  <T>(parameters: {
    id: ID;
    partitionKey: PK;
    codec: t.Type<T>;
  }): TE.TaskEither<GenericError | DecodeError | NotFoundError, T> =>
    pipe(
      TE.tryCatch(
        () =>
          deps.container.item(parameters.id, parameters.partitionKey).read(),
        (e) =>
          toGenericError(
            `Failed to reach Cosmosdb: ${e instanceof Error ? e.message : String(e)}`,
          ),
      ),
      TE.chainW((response) =>
        response.statusCode === 404
          ? TE.left<NotFoundError | DecodeError>(
              toNotFoundError("item not found"),
            )
          : pipe(
              parameters.codec.decode(response.resource),
              E.mapLeft(toDecodeError),
              TE.fromEither,
            ),
      ),
    );

export const performInsert =
  (deps: { container: Container }) =>
  <T extends ItemDefinition>(parameters: {
    document: T;
  }): TE.TaskEither<GenericError | ConflictError, void> =>
    pipe(
      TE.tryCatch(
        () =>
          deps.container.items.create(parameters.document, {
            disableAutomaticIdGeneration: true,
          }),
        // eslint-disable-next-line sonarjs/no-identical-functions
        (e) =>
          toGenericError(
            `Failed to reach Cosmosdb: ${e instanceof Error ? e.message : String(e)}`,
          ),
      ),
      TE.chainW((response) =>
        response.statusCode === 409
          ? TE.left(toConflictError())
          : TE.right(void 0),
      ),
    );

export const performTransaction =
  (deps: { container: Container }) =>
  (parameters: {
    batch: OperationInput[];
    partitionKey: NonEmptyString;
  }): TE.TaskEither<GenericError | NotFoundError, OperationResponse[]> =>
    pipe(
      TE.tryCatch(
        () =>
          deps.container.items.batch(
            parameters.batch,
            parameters.partitionKey,
            { disableAutomaticIdGeneration: true },
          ),
        (e) =>
          toGenericError(
            `Failed to perform transaction: ${e instanceof Error ? e.message : String(e)}`,
          ),
      ),
      TE.chainW(({ result }) =>
        TE.fromNullable(toNotFoundError("no results"))(result),
      ),
      TE.chainFirstW(
        TE.fromPredicate(
          (result) =>
            result !== undefined &&
            result.every(
              // https://learn.microsoft.com/en-us/rest/api/cosmos-db/http-status-codes-for-cosmosdb
              ({ statusCode }) => statusCode >= 200 && statusCode <= 204,
            ),
          (error) =>
            toGenericError(
              `Transaction failed with codes: ${error.map((r) => r.statusCode).join(",")}`,
            ),
        ),
      ),
    );
