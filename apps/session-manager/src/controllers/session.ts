import crypto from "crypto";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as B from "fp-ts/boolean";
import * as R from "fp-ts/Record";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";

import * as t from "io-ts";
import {
  withDefault,
  withoutUndefinedValues,
} from "@pagopa/ts-commons/lib/types";
import { NonEmptyString } from "io-ts-types";
import { sequenceS } from "fp-ts/lib/Apply";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
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
import { parseFilter } from "../utils/fields-filter";
import { LollipopAssertionRef } from "../generated/fast-login-api/LollipopAssertionRef";
import { AssertionRef } from "../generated/lollipop-api/AssertionRef";

// how many random bytes to generate for each session token
export const SESSION_TOKEN_LENGTH_BYTES = 48;

// how many random bytes to generate for each session ID
export const SESSION_ID_LENGTH_BYTES = 32;

// includes all PublicSession fields. This is here because the codegen doesnt
// support default parameters for query parameters
const DEFAULT_FILTER_QUERY_PARAM =
  "(spidLevel,lollipopAssertionRef,walletToken,myPortalToken,bpdToken,zendeskToken,fimsToken)";
const FilterDecoder = withDefault(
  NonEmptyString,
  DEFAULT_FILTER_QUERY_PARAM as NonEmptyString,
);

const getZendeskToken: RTE.ReaderTaskEither<
  FnAppRepo.FnAppAPIRepositoryDeps & WithUser,
  never,
  string
> = (deps) =>
  pipe(
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
    // shortcut to handle both rails with common logic
    TE.toUnion,
    T.map((suffix) => `${deps.user.zendesk_token}${suffix}`),
    TE.fromTask,
  );

const getLollipopAssertionRefForUser: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & WithUser,
  IResponseErrorInternal,
  AssertionRef | undefined
> = (deps) =>
  pipe(
    // Read the assertionRef related to the User for Lollipop.
    RedisSessionStorageService.getLollipopAssertionRefForUser({
      ...deps,
      fiscalCode: deps.user.fiscal_code,
    }),
    TE.mapLeft((error) =>
      ResponseErrorInternal(
        `Error retrieving the assertionRef: ${error.message}`,
      ),
    ),
    TE.map(O.toUndefined),
  );

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
  pipe(
    // decode and parse filter query param
    deps.req.query.filter,
    FilterDecoder.decode,
    TE.fromEither,
    TE.mapLeft((_) =>
      ResponseErrorValidation(
        "Validation error",
        "Could not decode filter query param",
      ),
    ),
    TE.chainW(
      flow(
        parseFilter,
        TE.fromEither,
        TE.mapLeft((_) =>
          ResponseErrorValidation(
            "Validation error",
            "Invalid filter query param",
          ),
        ),
        TE.chainW((fieldsToTakeSet) => {
          const fullFieldsTE: Record<
            string,
            TE.TaskEither<IResponseErrorInternal | never, string | undefined>
          > = {
            bpdToken: TE.of(deps.user.bpd_token),
            fimsToken: TE.of(deps.user.fims_token),
            lollipopAssertionRef: getLollipopAssertionRefForUser(deps),
            myPortalToken: TE.of(deps.user.myportal_token),
            spidLevel: TE.of(deps.user.spid_level),
            walletToken: TE.of(deps.user.wallet_token),
            zendeskToken: getZendeskToken(deps),
          };

          return pipe(
            fullFieldsTE,
            // NOTE: Set.has method has O(1) time complexity
            R.filterWithIndex((key, _) => fieldsToTakeSet.has(key)),
            (filteredObject) =>
              pipe(
                R.isEmpty(filteredObject),
                B.fold(
                  () => sequenceS(TE.ApplySeq)(filteredObject),
                  () => TE.right({}),
                ),
              ),
            // run computation only on requested fields
            TE.chain(
              flow(
                PublicSession.decode,
                TE.fromEither,
                TE.mapLeft((errors) =>
                  ResponseErrorInternal(
                    `Could not decode PublicSession: ${readableReportSimplified(errors)}`,
                  ),
                ),
                TE.map(ResponseSuccessJson),
              ),
            ),
          );
        }),
      ),
    ),
    // handled validation|internal error
    TE.orElseW(TE.right),
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
