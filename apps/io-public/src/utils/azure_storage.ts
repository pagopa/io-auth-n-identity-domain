import { GetTableEntityOptions, TableClient } from "@azure/data-tables";
import * as E from "fp-ts/lib/Either";
import { Either } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { flow, identity, pipe } from "fp-ts/lib/function";

export type StorageError = Error & {
  readonly statusCode?: number;
};

const ResourceNotFoundStatusCode = 404;

/**
 * Retrieve an entity from table storage
 *
 * @param tableClient the Azure TableClient
 * @param partitionKey
 * @param rowKey
 * @param options
 */
export const retrieveTableEntity = async (
  tableClient: TableClient,
  partitionKey: string,
  rowKey: string,
  options?: GetTableEntityOptions
): Promise<Either<StorageError, Option<unknown>>> =>
  tableClient.getEntity(partitionKey, rowKey, options).then(
    result => E.right(some(result)),
    err => {
      const errorAsStorageError = err as StorageError;
      if (errorAsStorageError?.statusCode === ResourceNotFoundStatusCode) {
        return E.right(none);
      }
      return E.left(errorAsStorageError);
    }
  );
/**
 * Retrieve an entity from table storage Decoded into the given io-ts type
 *
 * @param tableClient the Azure TableClient
 * @param partitionKey
 * @param rowKey
 * @param type an io-ts type used to decode the retrieved entity
 * @param options
 */
export const retrieveTableEntityDecoded = <T, S>(
  tableClient: TableClient,
  partitionKey: string,
  rowKey: string,
  type: t.Type<T, S, unknown>,
  options?: GetTableEntityOptions
): TE.TaskEither<StorageError | Error, Option<T>> =>
  pipe(
    TE.tryCatch(
      () => tableClient.getEntity(partitionKey, rowKey, options),
      identity
    ),
    TE.orElseW(err => {
      const errorAsStorageError = err as StorageError;
      if (errorAsStorageError?.statusCode === ResourceNotFoundStatusCode) {
        return TE.right(none);
      }
      return TE.left(errorAsStorageError);
    }),
    TE.chainEitherKW(
      flow(
        type.decode,
        E.bimap(err => new Error(readableReportSimplified(err)), some)
      )
    )
  );
