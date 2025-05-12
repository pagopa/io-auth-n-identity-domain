import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { sequenceS } from "fp-ts/lib/Apply";
import {
  LockUserAuthenticationDeps,
  SessionService,
} from "../services/session-service";
import { RequiredPathParamMiddleware } from "../utils/middlewares/required-path-param";
import { DomainErrorTypes } from "../utils/errors";
import { RequiredBodyMiddleware } from "../utils/middlewares/required-body";
import { AuthLockBody } from "../generated/definitions/internal/AuthLockBody";

type Dependencies = {
  SessionService: SessionService;
};

const lockUserAuthentication: (
  fiscalCode: FiscalCode,
  authLockBody: AuthLockBody,
) => RTE.ReaderTaskEither<
  Dependencies & LockUserAuthenticationDeps,
  H.HttpError | H.HttpConflictError,
  H.HttpResponse<null, 204>
> = (fiscalCode, authLockBody) => (deps) =>
  pipe(
    deps.SessionService.lockUserAuthentication(
      fiscalCode,
      authLockBody.unlock_code,
    )(deps),
    TE.map(() => H.empty),
    TE.mapLeft((error) => {
      switch (error.kind) {
        case DomainErrorTypes.GENERIC_ERROR:
          return new H.HttpError(error.causedBy?.message);
        case DomainErrorTypes.CONFLICT:
          return new H.HttpConflictError();
      }
    }),
  );

export const makeAuthLockHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<null, 204>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  Dependencies & LockUserAuthenticationDeps
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    sequenceS(RTE.ApplyPar)({
      fiscalCode: RequiredPathParamMiddleware(
        FiscalCode,
        "fiscalCode" as NonEmptyString,
      ),
      authLockBody: RequiredBodyMiddleware(AuthLockBody),
    }),
    RTE.fromTaskEither,
    RTE.chain(({ fiscalCode, authLockBody }) =>
      lockUserAuthentication(fiscalCode, authLockBody),
    ),
    RTE.orElseW((error) =>
      RTE.right(H.problemJson({ status: error.status, title: error.message })),
    ),
  ),
);

export const AuthLockFunction = httpAzureFunction(makeAuthLockHandler);
