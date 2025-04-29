import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as redisLib from "redis";
import { pipe } from "fp-ts/lib/function";
import * as H from "@pagopa/handler-kit";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { errorToHttpError } from "../utils/errors";
import { RedisRepository } from "../repositories/redis";
import { UserSessionInfo } from "../generated/internal/UserSessionInfo";

export type SessionServiceDeps = {
  RedisClientTask: TE.TaskEither<Error, redisLib.RedisClientType>;
  RedisRepository: RedisRepository;
};

const getUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<SessionServiceDeps, H.HttpError, UserSessionInfo> =
  (fiscalCode) => (deps) =>
    pipe(
      deps.RedisClientTask,
      TE.chain((redisClient) =>
        pipe(
          deps.RedisRepository.userHasActiveSessionsOrLV({
            client: redisClient,
            fiscalCode,
          }),
          TE.map((active) => UserSessionInfo.encode({ active })),
        ),
      ),
      TE.mapLeft(errorToHttpError),
    );

export type SessionService = typeof SessionService;
export const SessionService = { getUserSession };
