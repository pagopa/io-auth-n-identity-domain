import { TableClient, odata } from "@azure/data-tables";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as t from "io-ts";
import * as ROA from "fp-ts/lib/ReadonlyArray";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as AI from "../utils/async-iterable";
import { UnlockCode } from "../generated/definitions/internal/UnlockCode";

type Dependencies = {
  AuthenticationLockTableClient: TableClient;
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
) => RTE.ReaderTaskEither<Dependencies, Error, true> =
  (fiscalCode, unlockCode) => (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.AuthenticationLockTableClient.createEntity({
            partitionKey: fiscalCode,
            rowKey: unlockCode,

            // eslint-disable-next-line sort-keys
            CreatedAt: new Date(),
          }),
        () => new Error("Something went wrong creating the record"),
      ),
      TE.map(() => true as const),
    );

export type SessionLockRepository = typeof SessionLockRepository;
export const SessionLockRepository = {
  getUserAuthenticationLocks,
  isUserAuthenticationLocked,
  lockUserAuthentication,
};
