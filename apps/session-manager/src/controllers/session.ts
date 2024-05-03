import crypto from "crypto";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import { getLollipopAssertionRefForUser } from "../services/redis-session-storage";
import { RedisRepositoryDeps } from "../repositories/redis";
import { WithUser } from "../utils/user";
import { FnAppAPIRepositoryDeps } from "../repositories/api";
import { PublicSession } from "../generated/backend/PublicSession";
import { WithExpressRequest } from "../utils/express";
import { getProfile } from "../services/profile";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { ProfileWithEmailValidated } from "../types/profile";

// how many random bytes to generate for each session token
export const SESSION_TOKEN_LENGTH_BYTES = 48;

/**
 * @type Reader depedencies for GetSession handler of SessionController.
 */
type GetSessionDependencies = RedisRepositoryDeps &
  FnAppAPIRepositoryDeps &
  WithUser &
  WithExpressRequest;

/**
 * Returns the `PublicSession` success Response containing the SpidLevel and all the SSO Tokens
 * related to a specific user session.
 *
 * @param deps Input dependencies to execute the controller containing services and data from middlewares
 * @returns A TaskEither with Error or handled responses.
 */
const getSessionState: RTE.ReaderTaskEither<
  GetSessionDependencies,
  Error,
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseSuccessJson<PublicSession>
> = (deps) =>
  TE.tryCatch(
    async () => {
      const zendeskSuffix = await pipe(
        profileWithEmailValidatedOrError(deps),
        TE.bimap(
          // we generate 4 bytes and convert them to hex string for a length of 8 chars
          (_) => crypto.randomBytes(4).toString("hex"),
          // or we take 8 chars from the hash hex string
          (p) =>
            crypto
              .createHash("sha256")
              .update(p.email)
              .digest("hex")
              .substring(0, 8),
        ),
        TE.toUnion,
      )();

      // Read the assertionRef related to the User for Lollipop.
      const errorOrMaybeAssertionRef = await getLollipopAssertionRefForUser(
        deps.redisClientSelector,
      )(deps.user.fiscal_code)();
      if (E.isLeft(errorOrMaybeAssertionRef)) {
        return ResponseErrorInternal(
          `Error retrieving the assertionRef: ${errorOrMaybeAssertionRef.left.message}`,
        );
      }

      return ResponseSuccessJson({
        bpdToken: deps.user.bpd_token,
        fimsToken: deps.user.fims_token,
        lollipopAssertionRef: O.toUndefined(errorOrMaybeAssertionRef.right),
        myPortalToken: deps.user.myportal_token,
        spidLevel: deps.user.spid_level,
        walletToken: deps.user.wallet_token,
        zendeskToken: `${deps.user.zendesk_token}${zendeskSuffix}`,
      });
    },
    (err) => new Error(String(err)),
  );

const profileWithEmailValidatedOrError: RTE.ReaderTaskEither<
  FnAppAPIRepositoryDeps & WithUser,
  Error,
  ProfileWithEmailValidated
> = (deps) =>
  pipe(
    getProfile(deps),
    TE.fromTask,
    TE.chain(
      TE.fromPredicate(
        (r): r is IResponseSuccessJson<InitializedProfile> =>
          r.kind === "IResponseSuccessJson",
        (e) => new Error(`Error retrieving user profile | ${e.detail}`),
      ),
    ),
    TE.chainW((profile) =>
      pipe(
        profile.value,
        ProfileWithEmailValidated.decode,
        E.mapLeft(
          (_) => new Error("Profile has not a validated email address"),
        ),
        TE.fromEither,
      ),
    ),
  );

export { getSessionState };
