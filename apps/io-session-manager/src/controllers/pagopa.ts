import {
  IResponseErrorNotFound,
  IResponseErrorTooManyRequests,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import { EmailString } from "@pagopa/ts-commons/lib/strings";
import { FnAppAPIRepositoryDeps } from "../repositories/fn-app-api";
import { WithExpressRequest } from "../utils/express";
import { WithUser } from "../utils/user";
import { ProfileService, RedisSessionStorageService } from "../services";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { RedisRepositoryDeps } from "../repositories/redis";
import { PagoPAUser } from "../generated/pagopa/PagoPAUser";

const VALIDATION_ERROR_TITLE = "Validation Error";
type PagoPAGetUserHandler = RTE.ReaderTaskEither<
  { enableNoticeEmailCache: boolean } & FnAppAPIRepositoryDeps &
    RedisRepositoryDeps &
    WithUser &
    WithExpressRequest,
  Error,
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorTooManyRequests
  | IResponseSuccessJson<PagoPAUser>
>;

export const getUser: PagoPAGetUserHandler = (deps) => {
  const getProfileAndSaveNoticeEmailCache = pipe(
    ProfileService.getProfile(deps),
    // NOTE: remap all errors to a standard context aware error message
    TE.mapLeft((_) => Error("Internal server error")),
    TE.chain(
      TE.fromPredicate(
        (
          r,
        ): r is
          | IResponseErrorTooManyRequests
          | IResponseErrorNotFound
          | IResponseSuccessJson<InitializedProfile> =>
          r.kind !== "IResponseErrorInternal",
        ({ detail }) => Error(detail),
      ),
    ),
    TE.chainW((response) =>
      pipe(
        response,
        TE.fromPredicate(
          (r): r is IResponseSuccessJson<InitializedProfile> =>
            r.kind === "IResponseSuccessJson",
          (err) =>
            err as Exclude<
              typeof response,
              IResponseSuccessJson<InitializedProfile>
            >,
        ),
        TE.map((successResponse) =>
          // if no validated email is provided into InitializedProfile
          // we return an Option.none
          // Since January of 2024, all user are required to validate their
          // email. Nonetheless, we return an Option.none to preserve all uses
          // for this API
          successResponse.value.email &&
          successResponse.value.is_email_validated
            ? O.some(successResponse.value.email)
            : O.none,
        ),
      ),
    ),
    TE.chain((maybeNoticeEmail) => {
      if (O.isNone(maybeNoticeEmail)) {
        return TE.of(maybeNoticeEmail as O.Option<EmailString>);
      }
      return pipe(
        RedisSessionStorageService.setPagoPaNoticeEmail(
          deps.user,
          maybeNoticeEmail.value,
        )(deps),
        TE.mapLeft((_) => new Error("Error caching the notify email value")),
        TE.orElseW((__) => TE.right(maybeNoticeEmail)),
        TE.chain((__) => TE.right(maybeNoticeEmail)),
      );
    }),
  );

  const errorResponseOrNoticeEmail = deps.enableNoticeEmailCache
    ? pipe(
        RedisSessionStorageService.getPagoPaNoticeEmail(deps.user)(deps),
        TE.mapLeft((_) => new Error("Error reading the notify email cache")),
        TE.map(O.some),
        TE.orElse((_) => getProfileAndSaveNoticeEmailCache),
      )
    : getProfileAndSaveNoticeEmailCache;

  // If no valid notice_email is present a validation error is returned as response
  return pipe(
    errorResponseOrNoticeEmail,
    TE.chainW((maybeNoticeEmail) =>
      pipe(
        {
          family_name: deps.user.family_name,
          fiscal_code: deps.user.fiscal_code,
          name: deps.user.name,
          notice_email: O.toUndefined(maybeNoticeEmail),
          spid_email: deps.user.spid_email,
        },
        PagoPAUser.decode,
        TE.fromEither,
        TE.mapLeft((_) =>
          ResponseErrorValidation(VALIDATION_ERROR_TITLE, "Invalid User Data"),
        ),
        TE.map(ResponseSuccessJson),
      ),
    ),
    // remap all non internal errors to right taskeither
    TE.orElseW((error) =>
      error instanceof Error ? TE.left(error) : TE.right(error),
    ),
  );
};
