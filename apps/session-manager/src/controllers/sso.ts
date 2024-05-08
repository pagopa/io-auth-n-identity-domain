import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { identity, pipe } from "fp-ts/lib/function";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorTooManyRequests,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

import { RedisRepo, FnAppRepo } from "../repositories";
import { ProfileService } from "../services";
import { WithExpressRequest } from "../utils/express";
import { WithUser } from "../utils/user";

import { FIMSUser } from "../generated/fims/FIMSUser";
import { InitializedProfile } from "../generated/backend/InitializedProfile";

/**
 * @type Reader depedencies for GetSession handler of SessionController.
 */
type GetUserForFIMSDependencies = RedisRepo.RedisRepositoryDeps &
  FnAppRepo.FnAppAPIRepositoryDeps &
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
  pipe(
    ProfileService.getProfile(deps),
    TE.fromTask,
    TE.chain(
      TE.fromPredicate(
        (r): r is IResponseSuccessJson<InitializedProfile> =>
          r.kind === "IResponseSuccessJson",
        (err) =>
          err as
            | IResponseErrorInternal
            | IResponseErrorTooManyRequests
            | IResponseErrorNotFound,
      ),
    ),
    TE.chainW(({ value: userProfile }) =>
      pipe(
        FIMSUser.decode({
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
        }),
        E.map(ResponseSuccessJson),
        E.mapLeft((_) =>
          ResponseErrorInternal(errorsToReadableMessages(_).join(" / ")),
        ),
        TE.fromEither,
      ),
    ),
    TE.orElseW(TE.of),
  );
