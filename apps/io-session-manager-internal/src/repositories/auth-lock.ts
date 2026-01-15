import { TableClient, TransactionAction, odata } from "@azure/data-tables";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as t from "io-ts";
import * as ROA from "fp-ts/lib/ReadonlyArray";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { CustomTableClient } from "@pagopa/azure-storage-data-table-migration-kit";
import * as AI from "../utils/async-iterable";
import { UnlockCode } from "../generated/definitions/internal/UnlockCode";

type Dependencies = {
  AuthenticationLockTableClient: CustomTableClient;
};

// We want to use TableClient when creating authentication locks since
// the creation should go to the new storage account only.
type LockDependencies = {
  AuthenticationLockTableClientItn: TableClient;
};

export type NotReleasedAuthenticationLockData = t.TypeOf<
  typeof NotReleasedAuthenticationLockData
>;
const NotReleasedAuthenticationLockData = t.type({
  partitionKey: FiscalCode,
  rowKey: UnlockCode,

  // eslint-disable-next-line sort-keys
  CreatedAt: DateFromString,
});

const getUserAuthenticationLocks =
  (
    fiscalCode: FiscalCode,
  ): RTE.ReaderTaskEither<
    Dependencies,
    Error,
    NotReleasedAuthenticationLockData[]
  > =>
  ({ AuthenticationLockTableClient }) =>
    pipe(
      AuthenticationLockTableClient.listEntities({
        queryOptions: {
          filter: odata`PartitionKey eq ${fiscalCode} and not Released`,
        },
      }),
      AI.fromAsyncIterable,
      AI.foldTaskEither(E.toError),
      TE.chainEitherK(
        flow(
          t.array(NotReleasedAuthenticationLockData).decode,
          E.mapLeft((errors) => Error(readableReportSimplified(errors))),
        ),
      ),
    );

const isUserAuthenticationLocked =
  (
    fiscalCode: FiscalCode,
  ): RTE.ReaderTaskEither<Dependencies, Error, boolean> =>
  (deps) =>
    pipe(getUserAuthenticationLocks(fiscalCode)(deps), TE.map(ROA.isNonEmpty));

const lockUserAuthentication: (
  fiscalCode: FiscalCode,
  unlockCode: UnlockCode,
) => RTE.ReaderTaskEither<LockDependencies, Error, true> =
  (fiscalCode, unlockCode) => (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.AuthenticationLockTableClientItn.createEntity({
            partitionKey: fiscalCode,
            rowKey: unlockCode,

            // eslint-disable-next-line sort-keys
            CreatedAt: new Date(),
          }),
        () => new Error("Something went wrong creating the record"),
      ),
      TE.map(() => true as const),
    );

const unlockUserAuthentication: (
  fiscalCode: FiscalCode,
  unlockCodes: ReadonlyArray<UnlockCode>,
) => RTE.ReaderTaskEither<Dependencies, Error, true> =
  (fiscalCode, unlockCodes) => (deps) =>
    pipe(
      unlockCodes,
      ROA.map(
        (unlockCode) =>
          [
            "update",
            {
              partitionKey: fiscalCode,
              rowKey: unlockCode,
              // eslint-disable-next-line sort-keys
              Released: true,
            },
          ] as TransactionAction,
      ),
      (actions) =>
        TE.tryCatch(
          () =>
            deps.AuthenticationLockTableClient.submitTransaction(
              Array.from(actions),
            ),
          identity,
        ),
      TE.filterOrElseW(
        (response) => response.status === 202,
        () => void 0,
      ),
      TE.mapLeft(() => Error("Something went wrong updating the record")),
      TE.map(() => true as const),
    );

export type AuthLockRepository = typeof AuthLockRepository;
export const AuthLockRepository = {
  getUserAuthenticationLocks,
  isUserAuthenticationLocked,
  lockUserAuthentication,
  unlockUserAuthentication,
};
