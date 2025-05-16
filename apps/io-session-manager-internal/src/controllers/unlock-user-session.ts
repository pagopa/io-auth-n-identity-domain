import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";

import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { sequenceS } from "fp-ts/lib/Apply";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { SuccessResponse } from "../generated/definitions/internal/SuccessResponse";
import { RequiredPathParamMiddleware } from "../utils/middlewares/required-path-param";
import {
  BlockedUsersService,
  BlockedUsersServiceDeps,
} from "../services/blocked-users-service";
import { errorToHttpError } from "../utils/errors";

type Dependencies = {
  blockedUsersService: BlockedUsersService;
} & BlockedUsersServiceDeps;

export const makeUnlockUserSessionHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<SuccessResponse, 200>
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
    RTE.chain(({ fiscalCode }) =>
      pipe(
        RTE.ask<Dependencies>(),
        RTE.chainW(({ blockedUsersService }) =>
          blockedUsersService.unlockUserSession(fiscalCode),
        ),
        RTE.mapLeft(errorToHttpError),
      ),
    ),
    RTE.map(() => H.successJson({ message: "ok" })),
    RTE.orElseW((error) =>
      RTE.right(H.problemJson({ status: error.status, title: error.message })),
    ),
  ),
);

export const UnlockUserSessionFunction = httpAzureFunction(
  makeUnlockUserSessionHandler,
);
