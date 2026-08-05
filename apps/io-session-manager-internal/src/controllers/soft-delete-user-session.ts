import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { sequenceS } from "fp-ts/lib/Apply";
import {
  SessionService,
  SoftDeleteUserSessionDeps,
} from "../services/session-service";
import { RequiredPathParamMiddleware } from "../utils/middlewares/required-path-param";

type Dependencies = {
  SessionService: SessionService;
};

const softDeleteUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  Dependencies & SoftDeleteUserSessionDeps,
  H.HttpError,
  H.HttpResponse<null, 200>
> = (fiscalCode) => (deps) =>
  pipe(
    deps,
    deps.SessionService.softDeleteUserSession(fiscalCode),
    TE.map((_) => H.success(null)),
    TE.mapLeft(
      (genericError) => new H.HttpError(genericError.causedBy?.message),
    ),
  );

export const makeSoftDeleteUserSessionHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<null, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  Dependencies & SoftDeleteUserSessionDeps
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    sequenceS(RTE.ApplyPar)({
      fiscalCode: RequiredPathParamMiddleware(
        FiscalCode,
        "fiscalCode" as NonEmptyString,
      ),
    }),
    RTE.fromTaskEither,
    RTE.chain(({ fiscalCode }) => softDeleteUserSession(fiscalCode)),
    RTE.orElseW((error) =>
      RTE.right(H.problemJson({ status: error.status, title: error.message })),
    ),
  ),
);

export const SoftDeleteUserSessionFunction = httpAzureFunction(
  makeSoftDeleteUserSessionHandler,
);
