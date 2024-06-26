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
import { flow, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";

import { RedisRepo, FnAppRepo } from "../repositories";
import {
  LollipopService,
  RedisSessionStorageService,
  RedisSessionStorageServiceDepencency,
} from "../services";
import { WithUser } from "../utils/user";
import { WithExpressRequest } from "../utils/express";
import { profileWithEmailValidatedOrError } from "../utils/profile";
import { DependencyOf } from "../types/taskEither-utils";

import { PublicSession } from "../generated/backend/PublicSession";
import { SuccessResponse } from "../generated/backend/SuccessResponse";
import { log } from "../utils/logger";

// how many random bytes to generate for each session token
export const SESSION_TOKEN_LENGTH_BYTES = 48;

// how many random bytes to generate for each session ID
export const SESSION_ID_LENGTH_BYTES = 32;

/**
 * @type Reader depedencies for GetSession handler of SessionController.
 */
type GetSessionDependencies = RedisRepo.RedisRepositoryDeps &
  FnAppRepo.FnAppAPIRepositoryDeps &
  WithUser &
  WithExpressRequest;

/**
 * Returns the `PublicSession` success Response containing the SpidLevel and all the SSO Tokens
 * related to a specific user session.
 *
 * @param deps Input dependencies to execute the controller containing services and data from middlewares
 * @returns A TaskEither with Error or handled responses.
 */
export const getSessionState: RTE.ReaderTaskEither<
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
      const errorOrMaybeAssertionRef =
        await RedisSessionStorageService.getLollipopAssertionRefForUser({
          ...deps,
          fiscalCode: deps.user.fiscal_code,
        })();
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

export type LogoutDependencies = {
  lollipopService: typeof LollipopService;
} & DependencyOf<
  ReturnType<typeof LollipopService.deleteAssertionRefAssociation>
> &
  RedisSessionStorageServiceDepencency &
  WithUser &
  WithExpressRequest;

export const logout: RTE.ReaderTaskEither<
  LogoutDependencies,
  Error,
  IResponseSuccessJson<SuccessResponse>
> = (deps) =>
  pipe(
    // retrieve the assertionRef for the user
    deps.redisSessionStorageService.getLollipopAssertionRefForUser({
      ...deps,
      fiscalCode: deps.user.fiscal_code,
    }),
    TE.chain(
      flow(
        O.map((assertionRef) =>
          pipe(
            deps.lollipopService.deleteAssertionRefAssociation(
              deps.user.fiscal_code,
              assertionRef,
              "lollipop.error.logout",
              "logout from lollipop session",
            )(deps),
            TE.chain(
              TE.fromPredicate(
                (result) => result === true,
                () => new Error("Error revoking the AssertionRef"),
              ),
            ),
          ),
        ),
        // continue if there's no assertionRef on redis
        O.getOrElseW(() => TE.of(true)),
      ),
    ),
    TE.chain((_) =>
      pipe(
        deps.redisSessionStorageService.deleteUser(deps.user)(deps),
        TE.chain(
          TE.fromPredicate(
            (result) => result === true,
            () => new Error("Error destroying the user session"),
          ),
        ),
      ),
    ),
    TE.mapLeft((err) => {
      log.error(err.message);
      return err;
    }),
    TE.map((_) => ResponseSuccessJson({ message: "ok" })),
  );
