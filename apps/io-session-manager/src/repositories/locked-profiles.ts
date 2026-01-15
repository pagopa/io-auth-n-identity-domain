import * as RTE from "fp-ts/ReaderTaskEither";
import { TransactionAction, odata } from "@azure/data-tables";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as ROA from "fp-ts/ReadonlyArray";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import * as t from "io-ts";
import * as AI from "@pagopa/io-functions-commons/dist/src/utils/async_iterable_task";
import { CustomTableClient } from "@pagopa/azure-storage-data-table-migration-kit";
import { errorsToError } from "../utils/errors";
import { UnlockCode } from "../generated/fast-login-api/UnlockCode";

export type LockUserAuthenticationDeps = {
  lockUserTableClient: CustomTableClient;
};

export type NotReleasedAuthenticationLockData = t.TypeOf<
  typeof NotReleasedAuthenticationLockData
>;
const NotReleasedAuthenticationLockData = t.type({
  partitionKey: FiscalCode,
  rowKey: UnlockCode,
  CreatedAt: DateFromString,
});

export const getUserAuthenticationLocks: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  LockUserAuthenticationDeps,
  Error,
  ReadonlyArray<NotReleasedAuthenticationLockData>
> = (fiscalCode) => (deps) =>
  pipe(
    deps.lockUserTableClient.listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq ${fiscalCode} and not Released`,
      },
    }),
    AI.fromAsyncIterable,
    AI.foldTaskEither(E.toError),
    TE.chainEitherK(
      flow(
        t.array(NotReleasedAuthenticationLockData).decode,
        E.mapLeft(errorsToError),
      ),
    ),
  );
