import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import { pipe } from "fp-ts/function";
import * as AP from "fp-ts/lib/Apply";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { RequiredBodyMiddleware } from "../middlewares/request";
import { UnlockSessionDependency } from "../utils/ioweb/dependency";
import { UnlockCode } from "../generated/definitions/backend-internal/UnlockCode";
import { UnlockSessionData } from "../generated/definitions/internal/UnlockSessionData";

const unlockUserSession: (
  fiscalcode: FiscalCode,
  unlockCode?: UnlockCode
) => RTE.ReaderTaskEither<UnlockSessionDependency, H.HttpError, undefined> = (
  fiscalcode,
  unlock_code
) => ({ backendInternalClient }) =>
  pipe(
    TE.tryCatch(
      () =>
        backendInternalClient.releaseAuthLock({
          body: { unlock_code },
          fiscalcode
        }),
      () => new H.HttpError("Error while calling the downstream component")
    ),
    TE.chainEitherK(
      E.mapLeft(
        _ => new H.HttpError("Unexpected response from backend internal")
      )
    ),
    TE.chainW(({ status }) =>
      status === 204
        ? TE.right(undefined)
        : status === 403
        ? TE.left(new H.HttpForbiddenError("Forbidden"))
        : TE.left(
            new H.HttpError(
              `Error while deleting user session: downstream component returned ${status}`
            )
          )
    )
  );

export const makeUnlockSessionHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<null, 204>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  UnlockSessionDependency
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    AP.sequenceS(RTE.ApplyPar)({
      body: RequiredBodyMiddleware(UnlockSessionData)
    }),
    RTE.fromTaskEither,
    RTE.chain(({ body }) =>
      unlockUserSession(body.fiscal_code, body.unlock_code)
    ),
    RTE.map(() => H.empty),
    RTE.orElseW(error =>
      RTE.right(H.problemJson({ status: error.status, title: error.message }))
    )
  )
);

export const UnlockSessionFunction = httpAzureFunction(
  makeUnlockSessionHandler
);
