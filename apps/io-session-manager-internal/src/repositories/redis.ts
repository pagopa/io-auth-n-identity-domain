import * as redisLib from "redis";
import * as A from "fp-ts/lib/Array";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as B from "fp-ts/boolean";
import { flow, pipe } from "fp-ts/lib/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import {
  LollipopData,
  NullableBackendAssertionRefFromString,
} from "../utils/lollipop";
import { LoginTypeEnum } from "../utils/fast-login";
import { SessionInfo } from "../generated/internal/SessionInfo";
import { SessionsList } from "../generated/internal/SessionsList";

const lollipopDataPrefix = "KEYS-";
const userSessionsSetKeyPrefix = "USERSESSIONS-";
const sessionKeyPrefix = "SESSION-";

export const sessionNotFoundError = new Error("Session not found");

type Dependencies = { client: redisLib.RedisClusterType };

const getLollipopDataForUser: RTE.ReaderTaskEither<
  Dependencies & { fiscalCode: FiscalCode },
  Error,
  O.Option<LollipopData>
> = ({ client, fiscalCode }) =>
  pipe(
    TE.tryCatch(
      () => client.get(`${lollipopDataPrefix}${fiscalCode}`),
      E.toError,
    ),
    TE.chain(
      flow(
        NullableBackendAssertionRefFromString.decode,
        E.map(
          flow(
            O.fromNullable,
            O.map((storedValue) =>
              LollipopData.is(storedValue)
                ? storedValue
                : // Remap plain string to LollipopData
                  {
                    assertionRef: storedValue,
                    loginType: LoginTypeEnum.LEGACY,
                  },
            ),
          ),
        ),
        E.mapLeft(
          (validationErrors) =>
            new Error(errorsToReadableMessages(validationErrors).join("/")),
        ),
        TE.fromEither,
      ),
    ),
  );

const customMGet: RTE.ReaderTaskEither<
  Dependencies & { keys: string[] },
  Error,
  Array<string | null>
> = ({ keys, client }) =>
  pipe(
    keys,
    A.map((singleKey) => TE.tryCatch(() => client.get(singleKey), E.toError)),
    A.sequence(TE.ApplicativePar),
  );

const parseUserSessionList = (userSessionTokensResult: ReadonlyArray<string>) =>
  userSessionTokensResult.reduce(
    (prev: SessionsList, _) =>
      pipe(
        E.parseJSON(_, E.toError),
        E.chain((data) =>
          pipe(
            SessionInfo.decode(data),
            E.mapLeft(
              (err) => new Error(errorsToReadableMessages(err).join("/")),
            ),
          ),
        ),
        E.fold(
          (_err) => prev,
          (sessionInfo) => ({
            sessions: [...prev.sessions, sessionInfo],
          }),
        ),
      ),
    { sessions: [] } as SessionsList,
  );

export const userHasActiveSessionsLegacy: RTE.ReaderTaskEither<
  Dependencies & { fiscalCode: FiscalCode },
  Error,
  boolean
> = ({ client, fiscalCode }) =>
  pipe(
    TE.tryCatch(
      () => client.sMembers(`${userSessionsSetKeyPrefix}${fiscalCode}`),
      E.toError,
    ),
    TE.chain(
      TE.fromPredicate(
        (res): res is NonEmptyArray<string> =>
          Array.isArray(res) && res.length > 0,
        () => sessionNotFoundError,
      ),
    ),
    TE.fold(
      (err) =>
        err === sessionNotFoundError ? TE.right(false as const) : TE.left(err),
      (userSessions) =>
        pipe(
          customMGet({ client, keys: userSessions }),

          TE.map((keys) =>
            parseUserSessionList(
              keys.filter<string>((key): key is string => key !== null),
            ).sessions.map(
              (session) => `${sessionKeyPrefix}${session.sessionToken}`,
            ),
          ),
          TE.chain((sessionsList) =>
            pipe(
              sessionsList.length !== 0,
              B.fold(
                () => TE.right(false as const),
                () =>
                  pipe(
                    customMGet({ client, keys: sessionsList }),
                    // Skipping null values from the array
                    TE.map(A.filter((key): key is string => key !== null)),
                    TE.map((filteredList) => filteredList.length > 0),
                  ),
              ),
            ),
          ),
        ),
    ),
  );

const userHasActiveSessionsOrLV: RTE.ReaderTaskEither<
  Dependencies & { fiscalCode: FiscalCode },
  Error,
  boolean
> = (deps) =>
  pipe(
    getLollipopDataForUser(deps),
    TE.chain(
      flow(
        O.map((data) =>
          pipe(
            data.loginType === LoginTypeEnum.LV,
            B.fold(
              // if login type is not LV, check for active user sessions
              () => userHasActiveSessionsLegacy(deps),
              // if login type is LV, return true
              () => TE.of<Error, true>(true),
            ),
          ),
        ),
        // if no LollipopData was found, return false
        O.getOrElseW(() => TE.of<Error, false>(false)),
      ),
    ),
  );

export type RedisRepository = typeof RedisRepository;
export const RedisRepository = { userHasActiveSessionsOrLV };
