import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { identity, pipe } from "fp-ts/lib/function";
import { sequenceS } from "fp-ts/lib/Apply";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorTooManyRequests,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

import { FnAppRepo } from "../repositories";
import {
  ProfileService,
  LollipopServiceDepencency,
  RedisSessionStorageServiceDepencency,
} from "../services";
import { WithExpressRequest } from "../utils/express";
import { WithUser } from "../utils/user";
import { RightOf } from "../types/taskEither-utils";

import { FIMSUser } from "../generated/fims/FIMSUser";
import { FIMSPlusUser } from "../generated/fims/FIMSPlusUser";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import {
  isGenericError,
  isNotFoundError,
  isUnauthorizedError,
  toNotFoundError,
} from "../models/domain-errors";
import { LCParamsForFims } from "../generated/fims/LCParamsForFims";
import { GetLollipopUserForFIMSPayload } from "../generated/fims/GetLollipopUserForFIMSPayload";
import { AppInsightsDeps } from "../utils/appinsights";

/**
 * @type Reader depedencies for GetSession handler of SessionController.
 */
type GetUserForFIMSDependencies = FnAppRepo.FnAppAPIRepositoryDeps &
  WithUser &
  WithExpressRequest;

/**
 *
 */
export const getUserForFIMS: RTE.ReaderTaskEither<
  GetUserForFIMSDependencies,
  never,
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseErrorTooManyRequests
  | IResponseErrorNotFound
  | IResponseSuccessJson<FIMSUser>
> = (deps) =>
  pipe(getFimsUser(deps), TE.map(ResponseSuccessJson), TE.orElseW(TE.of));

/**
 * getLollipopUserForFIMS
 */

type GetLollipopUserForFIMSDependencies = GetUserForFIMSDependencies &
  RedisSessionStorageServiceDepencency &
  LollipopServiceDepencency &
  AppInsightsDeps;

type GetuserForFIMSPlusErrors =
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseErrorTooManyRequests
  | IResponseErrorNotFound;

export const getLollipopUserForFIMS: RTE.ReaderTaskEither<
  GetLollipopUserForFIMSDependencies,
  never,
  GetuserForFIMSPlusErrors | IResponseSuccessJson<FIMSPlusUser>
> = (deps) =>
  pipe(
    deps.req.body,
    GetLollipopUserForFIMSPayload.decode,
    TE.fromEither,
    TE.mapLeft((error) =>
      ResponseErrorValidation(
        "Bad request",
        errorsToReadableMessages(error).join(" / "),
      ),
    ),
    TE.chainW((payload) =>
      sequenceS(TE.ApplicativePar)({
        lc_params: generateLCParamsForFIMSUser(
          deps.user.fiscal_code,
          payload.operation_id,
        )(deps) as TE.TaskEither<GetuserForFIMSPlusErrors, LCParamsForFims>,
        profile: getFimsUser(deps) as TE.TaskEither<
          GetuserForFIMSPlusErrors,
          FIMSUser
        >,
      }),
    ),
    TE.map(ResponseSuccessJson),
    TE.orElseW(TE.of),
  );

// -------------------
// Private methods
// -------------------

const getFimsUser: RTE.ReaderTaskEither<
  GetUserForFIMSDependencies,
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseErrorTooManyRequests
  | IResponseErrorNotFound,
  FIMSUser
> = (deps) =>
  pipe(
    ProfileService.getProfile(deps),
    TE.mapLeft((e) => ResponseErrorInternal(e.message)),
    TE.chainW(filterGetProfileSuccessResponse),
    TE.map((response) => response.value),
    TE.chainW(toFIMSUser(deps)),
  );

const filterGetProfileSuccessResponse = (
  response: RightOf<ReturnType<typeof ProfileService.getProfile>>,
) =>
  pipe(
    response,
    TE.fromPredicate(
      (r): r is IResponseSuccessJson<InitializedProfile> =>
        r.kind === "IResponseSuccessJson",
      (err) =>
        err as Exclude<
          RightOf<typeof response>,
          IResponseSuccessJson<InitializedProfile>
        >,
    ),
  );

const toFIMSUser =
  (deps: GetUserForFIMSDependencies) => (userProfile: InitializedProfile) =>
    pipe(
      {
        acr: deps.user.spid_level,
        auth_time: deps.user.created_at,
        date_of_birth: deps.user.date_of_birth,
        // If the email is not validated yet, the value returned will be undefined
        email: pipe(
          O.fromNullable(userProfile.is_email_validated),
          O.chain(O.fromPredicate(identity)),
          O.chain(() => O.fromNullable(userProfile.email)),
          O.toUndefined,
        ),
        family_name: deps.user.family_name,
        fiscal_code: deps.user.fiscal_code,
        name: deps.user.name,
      },
      FIMSUser.decode,
      E.mapLeft((_) =>
        ResponseErrorInternal(errorsToReadableMessages(_).join(" / ")),
      ),
      TE.fromEither,
    );

const generateLCParamsForFIMSUser: (
  fiscalCode: FiscalCode,
  operationId: NonEmptyString,
) => RTE.ReaderTaskEither<
  GetLollipopUserForFIMSDependencies,
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized,
  LCParamsForFims
> = (fiscalCode, operationId) => (deps) =>
  pipe(
    deps.redisSessionStorageService.getLollipopAssertionRefForUser({
      ...deps,
      fiscalCode,
    }),
    TE.chainW(TE.fromOption(() => toNotFoundError("AssertionRef"))),
    TE.chainW((assertionRef) =>
      deps.lollipopService.generateLCParams(
        assertionRef,
        operationId,
        fiscalCode,
      )(deps),
    ),
    TE.map((response) => ({
      assertion_ref: response.assertion_ref,
      lc_authentication_bearer: response.lc_authentication_bearer,
      pub_key: response.pub_key,
    })),
    TE.mapLeft((e) =>
      e instanceof Error
        ? ResponseErrorInternal(e.message)
        : isGenericError(e)
          ? ResponseErrorInternal(
              e.causedBy?.message ??
                "Generic error while generating LC Params for FIMS+ User",
            )
          : isUnauthorizedError(e)
            ? ResponseErrorForbiddenNotAuthorized
            : isNotFoundError(e)
              ? ResponseErrorNotFound(
                  "Not Found",
                  `Unable to find entity of type ${e.entityType}`,
                )
              : ResponseErrorInternal(
                  "Unexpected error while generating LC Params for FIMS+ User",
                ),
    ),
  );
