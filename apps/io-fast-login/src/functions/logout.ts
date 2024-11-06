import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import { pipe } from "fp-ts/function";
import * as AP from "fp-ts/Apply";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { RequiredBodyMiddleware } from "../middlewares/request";
import { LogoutDependencies } from "../utils/ioweb/dependency";
import { SuccessResponse as DeleteUserSessionSuccessResponse } from "../generated/definitions/backend-internal/SuccessResponse";
import { LogoutData } from "../generated/definitions/internal/LogoutData";

const deleteUserSession: (
  fiscal_code: FiscalCode
) => RTE.ReaderTaskEither<
  LogoutDependencies,
  H.HttpError,
  DeleteUserSessionSuccessResponse
> = fiscal_code => ({ backendInternalClient }) =>
  pipe(
    TE.tryCatch(
      () =>
        backendInternalClient.deleteUserSession({ fiscalcode: fiscal_code }),
      () => new H.HttpError("Error while calling the downstream component")
    ),
    TE.chainEitherK(
      E.mapLeft(
        _ => new H.HttpError("Unexpected response from backend internal")
      )
    ),
    TE.chain(
      TE.fromPredicate(
        ({ status }) => status === 200,
        ({ status }) =>
          new H.HttpError(
            `Error while deleting user session: downstream component returned ${status}`
          )
      )
    )
  );

export const makeLogoutHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<null, 204>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  LogoutDependencies
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    AP.sequenceS(RTE.ApplyPar)({
      bodyParams: RequiredBodyMiddleware(LogoutData)
    }),
    RTE.fromTaskEither,
    RTE.chain(({ bodyParams }) => deleteUserSession(bodyParams.fiscal_code)),
    RTE.map(() => H.empty),
    RTE.orElseW(error =>
      RTE.right(H.problemJson({ status: error.status, title: error.message }))
    )
  )
);

export const LogoutFunction = httpAzureFunction(makeLogoutHandler);
