import { AzureFunction, Context } from "@azure/functions";
import { Either } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as AI from "../utils/async-iterable-task";
import {
  SessionExpirationRepository,
  Dependencies as SessionExpirationRepositoryDependencies
} from "../repositories/session-expiration";
import { Interval } from "../types/interval";
import { SessionExpiration } from "../models/session-expiration-model";

type FunctionDependencies = {
  sessionExpirationRepository: SessionExpirationRepository;
} & SessionExpirationRepositoryDependencies;

const processPage = (
  page: ReadonlyArray<Either<unknown, SessionExpiration>>
): TE.TaskEither<Error, void> => {
  const [rights, lefts] = [RA.rights(page), RA.lefts(page)];

  if (rights.length > 0) {
    console.log("Processing session expiration:", rights.length);
  }

  if (lefts.length > 0) {
    return TE.left(
      new Error(
        `Error decoding session expiration: ${lefts.length} errors found`
      )
    );
  }

  if (rights.length < 100) {
    console.log("Forcing error");
    return TE.left(new Error(`Forcing error`));
  }

  console.log("OK");
  return TE.right(void 0);
};

export const processExpirations: (
  interval: Interval
) => RTE.ReaderTaskEither<FunctionDependencies, Error, void> = (
  interval: Interval
) => ({ sessionExpirationRepository, ...deps }) =>
  pipe(
    sessionExpirationRepository.findByExpirationDate(interval)(deps),
    TE.map(AI.fromAsyncIterable),
    TE.map(AI.map(processPage)),
    // Use reduceTaskEither to collect all results
    TE.chain(
      AI.reduceTaskEither(
        err => err as Error,
        [] as Array<Either<Error, void>>,
        async (acc, taskEither) => {
          const result = await taskEither();
          return [...acc, result];
        }
      )
    ),

    TE.chain(results =>
      pipe(
        A.findFirst(E.isLeft)(results),
        O.fold(
          () => TE.right(void 0),
          o => TE.left(o.left)
        )
      )
    )
  );

export const ExpiredSessionsScannerFunction = (
  deps: FunctionDependencies
): AzureFunction => async (context: Context, _timer: unknown) => {
  await pipe(
    processExpirations({
      from: new Date(1746992583924),
      to: new Date(1746992883924)
    })(deps),
    TE.fold(
      error => {
        context.log.error(
          `Error processing expired sessions: ${error.message}`
        );
        return T.of(undefined);
      },
      () => {
        context.log("Expired sessions scan completed.");
        return T.of(undefined);
      }
    )
  )();
};
