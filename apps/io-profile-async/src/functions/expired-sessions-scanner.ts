import { AzureFunction, Context } from "@azure/functions";
import { pipe } from "fp-ts/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { Either } from "fp-ts/lib/Either";
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
    console.error("Error decoding session expiration:", lefts.length);
    lefts.forEach((left, i) => {
      console.error(`Error decoding session expiration at index ${i}:`, left);
    });
    return TE.left(
      new Error(
        `Error decoding session expiration: ${lefts.length} errors found`
      )
    );
  }
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
    TE.map(AI.map(page => processPage(page))),
    TE.chain(ait => TE.fromTask(AI.run(ait))),
    // Simply print the end of the process
    TE.map(_ => {
      console.log("Processing expired sessions completed");
      return void 0;
    })
  );

export const ExpiredSessionsScannerFunction = (
  deps: FunctionDependencies
): AzureFunction => async (context: Context, _timer: unknown) =>
  pipe(
    processExpirations({
      from: new Date(1746992583924),
      to: new Date(1746992883924)
      // from: new Date(Date.now() - 1000 * 60 * 60 * 24),
      // to: new Date(Date.now())
    })(deps),
    TE.fold(
      error => {
        context.log.error(
          `Error processing expired sessions: ${error.message}`
        );
        throw error;
      },
      () => {
        context.log("Expired sessions scan completed.");
        return T.of(undefined);
      }
    )
  )();
