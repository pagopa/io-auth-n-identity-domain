import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { sequenceS } from "fp-ts/lib/Apply";
import { OutputOf } from "io-ts";
import { UserSessionInfo } from "../generated/definitions/internal/UserSessionInfo";
import {
  GetUserSessionDeps,
  GetUserSessionStateDeps,
  SessionService,
} from "../services/session-service";
import { RequiredPathParamMiddleware } from "../utils/middlewares/required-path-param";
import { errorToHttpError } from "../utils/errors";
import { SessionState } from "../generated/definitions/internal/SessionState";

type Dependencies = {
  SessionService: SessionService;
};

const getUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  Dependencies & GetUserSessionDeps,
  H.HttpError,
  H.HttpResponse<UserSessionInfo, 200>
> = (fiscalCode) => (deps) =>
  pipe(
    deps.SessionService.getUserSession(fiscalCode)(deps),
    TE.map(H.successJson),
    TE.mapLeft(errorToHttpError),
  );

export const makeGetSessionHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<UserSessionInfo, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  Dependencies & GetUserSessionDeps
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
    RTE.chain(({ fiscalCode }) => getUserSession(fiscalCode)),
    RTE.orElseW((error) =>
      RTE.right(H.problemJson({ status: error.status, title: error.message })),
    ),
  ),
);

const getUserSessionState: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  Dependencies & GetUserSessionStateDeps,
  H.HttpError,
  H.HttpResponse<OutputOf<typeof SessionState>, 200>
> = (fiscalCode) => (deps) =>
  pipe(
    deps.SessionService.getUserSessionState(fiscalCode)(deps),
    TE.map(H.successJson),
    TE.mapLeft((error) => new H.HttpError(error.causedBy?.message)),
  );

export const makeGetSessionStateHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<OutputOf<typeof SessionState>, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  Dependencies & GetUserSessionStateDeps
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
    RTE.chain(({ fiscalCode }) => getUserSessionState(fiscalCode)),
    RTE.orElseW((error) =>
      RTE.right(H.problemJson({ status: error.status, title: error.message })),
    ),
  ),
);

export const GetSessionFunction = httpAzureFunction(makeGetSessionHandler);
export const GetSessionStateFunction = httpAzureFunction(
  makeGetSessionStateHandler,
);
