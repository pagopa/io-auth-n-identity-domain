import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as RTE from "fp-ts/ReaderTaskEither";
import { flow } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as ROA from "fp-ts/ReadonlyArray";
import { LockedProfileRepo } from "../repositories";
import { LockUserAuthenticationDeps } from "../repositories/locked-profile";

type AuthLockServiceDeps = LockUserAuthenticationDeps;

export const isUserAuthenticationLocked: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<AuthLockServiceDeps, Error, boolean> = (fiscalCode) =>
  flow(
    LockedProfileRepo.getUserAuthenticationLocks(fiscalCode),
    TE.map(ROA.isNonEmpty),
  );
