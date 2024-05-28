import * as RTE from "fp-ts/ReaderTaskEither";
import { TableClient, TransactionAction, odata } from "@azure/data-tables";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as ROA from "fp-ts/ReadonlyArray";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import * as t from "io-ts";
import * as AI from "@pagopa/io-functions-commons/dist/src/utils/async_iterable_task";
import { errorsToError } from "../utils/errors";
import { UnlockCode } from "../generated/fast-login-api/UnlockCode";

export type LockUserAuthenticationDeps = {
  lockUserTableClient: TableClient;
};

export type NotReleasedAuthenticationLockData = t.TypeOf<
  typeof NotReleasedAuthenticationLockData
>;
const NotReleasedAuthenticationLockData = t.type({
  partitionKey: FiscalCode,
  rowKey: UnlockCode,
  CreatedAt: DateFromString,
});

export const lockUserAuthentication: (
  fiscalCode: FiscalCode,
  unlockCode: UnlockCode,
) => RTE.ReaderTaskEither<LockUserAuthenticationDeps, Error, true> =
  (fiscalCode, unlockCode) => (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.lockUserTableClient.createEntity({
            partitionKey: fiscalCode,
            rowKey: unlockCode,
            CreatedAt: new Date(),
          }),
        (_) => new Error("Something went wrong creating the record"),
      ),
      TE.map((_) => true as const),
    );

export const unlockUserAuthentication: (
  fiscalCode: FiscalCode,
  unlockCodes: ReadonlyArray<UnlockCode>,
) => RTE.ReaderTaskEither<LockUserAuthenticationDeps, Error, true> =
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
              Released: true,
            },
          ] as TransactionAction,
      ),
      (actions) =>
        TE.tryCatch(
          () => deps.lockUserTableClient.submitTransaction(Array.from(actions)),
          identity,
        ),
      TE.filterOrElseW(
        (response) => response.status === 202,
        () => void 0,
      ),
      TE.mapLeft(() => new Error("Something went wrong updating the record")),
      TE.map(() => true as const),
    );

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
