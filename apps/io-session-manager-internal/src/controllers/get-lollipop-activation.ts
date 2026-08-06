import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { sequenceS } from "fp-ts/lib/Apply";
import { OutputOf } from "io-ts";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import {
  GetUserLollipopActivationDeps,
  SessionService,
} from "../services/session-service";
import { RequiredPathParamMiddleware } from "../utils/middlewares/required-path-param";
import { DomainErrorTypes } from "../utils/errors";

type Dependencies = {
  SessionService: SessionService;
};

export type LollipopActivationResponse = {
  readonly assertion_ref: OutputOf<typeof AssertionRef>;
};

const getUserLollipopActivation: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  Dependencies & GetUserLollipopActivationDeps,
  H.HttpError | H.HttpNotFoundError,
  H.HttpResponse<LollipopActivationResponse, 200>
> = (fiscalCode) => (deps) =>
  pipe(
    deps,
    deps.SessionService.getUserLollipopActivation(fiscalCode),
    TE.map((assertionRef) =>
      H.successJson({
        assertion_ref: AssertionRef.encode(assertionRef),
      }),
    ),
    TE.mapLeft((error) => {
      switch (error.kind) {
        case DomainErrorTypes.GENERIC_ERROR:
          return new H.HttpError(error.causedBy?.message);
        case DomainErrorTypes.NOT_FOUND:
          return new H.HttpNotFoundError(error.causedBy?.message);
      }
    }),
  );

export const makeGetUserLollipopActivationHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<LollipopActivationResponse, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  Dependencies & GetUserLollipopActivationDeps
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
    RTE.chain(({ fiscalCode }) => getUserLollipopActivation(fiscalCode)),
    RTE.orElseW((error) =>
      RTE.right(H.problemJson({ status: error.status, title: error.message })),
    ),
  ),
);

export const GetUserLollipopActivationFunction = httpAzureFunction(
  makeGetUserLollipopActivationHandler,
);
