import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { sequenceS } from "fp-ts/lib/Apply";
import { UserSessionInfo } from "../generated/internal/UserSessionInfo";
import {
  SessionService,
  SessionServiceDeps,
} from "../services/session-service";
import { RequiredPathParamMiddleware } from "../utils/middlewares";

type Dependencies = {
  SessionService: SessionService;
} & SessionServiceDeps;

const getUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  Dependencies,
  H.HttpError,
  H.HttpResponse<UserSessionInfo, 200>
> = (fiscalCode) => (deps) =>
  pipe(
    deps.SessionService.getUserSession(fiscalCode)(deps),
    TE.map(H.successJson),
  );

export const makeGetSessionHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<UserSessionInfo, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  Dependencies
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

export const GetSessionFunction = httpAzureFunction(makeGetSessionHandler);
