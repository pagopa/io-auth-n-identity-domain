import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import { RedisRepo } from "../repositories";
import { oidcAusiliarDataPrefix } from "../repositories/redis";
import { LoginAusiliarData } from "../types/oidc";
import { RedisClientMode } from "../types/redis";

const parseLoginAusiliarData = (
  value: string,
): E.Either<Error, LoginAusiliarData> =>
  pipe(
    E.parseJSON(value, E.toError),
    E.chain(
      flow(
        LoginAusiliarData.decode,
        E.mapLeft((err) => new Error(readableReportSimplified(err))),
      ),
    ),
  );

const singleStringReplyAsync = (
  command: TE.TaskEither<Error, string | null>,
) =>
  pipe(
    command,
    TE.map((reply) => reply === "OK"),
  );

const falsyResponseToErrorAsync =
  (error: Error) =>
  (response: TE.TaskEither<Error, boolean>): TE.TaskEither<Error, boolean> =>
    pipe(
      response,
      TE.chain((_) => (_ ? TE.right(_) : TE.left(error))),
    );

/**
 * Persists the ausiliar data associated to a reserved OIDC authorization
 * request, keyed by `state`, with the given expiration. Used by the
 * `reserve` step of the OneIdentity login flow.
 * @param state the `state` value returned by the `reserve` step, used as
 *   the Redis key suffix
 * @param data the ausiliar data to persist
 * @param expireSec the expiration (seconds) applied to the stored key
 * @returns whether the value has been correctly stored, or an error
 */
export const save: (
  state: NonEmptyString,
  data: LoginAusiliarData,
  expireSec: Second,
) => RTE.ReaderTaskEither<RedisRepo.RedisRepositoryDeps, Error, boolean> =
  (state, data, expireSec) => (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${oidcAusiliarDataPrefix}${state}`,
              expireSec,
              JSON.stringify(LoginAusiliarData.encode(data)),
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting ausiliar data key")),
    );

/**
 * Reads and atomically deletes the ausiliar data associated to a reserved
 * OIDC authorization request `state`. The data is single-use: it's meant
 * to be consumed once by the (future) callback step of the OneIdentity
 * login flow, which is why the read is paired with a delete.
 * @param state the `state` value returned by the `reserve` step, used as
 *   the Redis key suffix
 * @returns the ausiliar data if present, `none` if the key was missing or
 *   already expired, or an error
 */
export const getAndDelete: (
  state: NonEmptyString,
) => RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps,
  Error,
  O.Option<LoginAusiliarData>
> = (state) => (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.redisClientSelector
          .selectOne(RedisClientMode.FAST)
          .getDel(`${oidcAusiliarDataPrefix}${state}`),
      E.toError,
    ),
    TE.chain((value) =>
      pipe(
        value,
        O.fromNullable,
        O.fold(
          () => TE.right<Error, O.Option<LoginAusiliarData>>(O.none),
          (raw) =>
            pipe(parseLoginAusiliarData(raw), E.map(O.some), TE.fromEither),
        ),
      ),
    ),
  );
