import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as AP from "fp-ts/lib/Apply";
import { empty } from "@pagopa/handler-kit";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { LockSessionData } from "../generated/definitions/internal/LockSessionData";
import { RequiredBodyMiddleware } from "../middlewares/request";
import { LockSessionDependency } from "../utils/ioweb/dependency";
import { UnlockCode } from "../generated/definitions/internal/UnlockCode";

const lockUserSession: (
  fiscal_code: FiscalCode,
  unlock_code: UnlockCode
) => RTE.ReaderTaskEither<
  LockSessionDependency,
  H.HttpError | H.HttpConflictError,
  undefined
> = (fiscal_code, unlock_code) => ({ backendInternalClient }) =>
  pipe(
    TE.tryCatch(
      () =>
        backendInternalClient.authLock({
          body: { unlock_code },
          fiscalcode: fiscal_code
        }),
      () => new H.HttpError("Error while calling the downstream component")
    ),
    TE.chainEitherK(
      E.mapLeft(
        _ => new H.HttpError("Unexpected response from backend internal")
      )
    ),
    TE.chain(({ status }) =>
      status === 204
        ? TE.right(undefined)
        : status === 409
        ? TE.left(
            new H.HttpConflictError("The user lock has already been created.")
          )
        : TE.left(
            new H.HttpError(
              `Error while deleting user session: downstream component returned ${status}`
            )
          )
    )
  );

export const makeLockSessionHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<null, 204>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  LockSessionDependency
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    AP.sequenceS(RTE.ApplyPar)({
      body: RequiredBodyMiddleware(LockSessionData)
    }),
    RTE.fromTaskEither,
    RTE.chain(({ body }) =>
      lockUserSession(body.fiscal_code, body.unlock_code)
    ),
    RTE.map(() => empty),
    RTE.orElseW(error =>
      RTE.right(H.problemJson({ status: error.status, title: error.message }))
    )
  )
);

export const LockSessionFunction = httpAzureFunction(makeLockSessionHandler);
