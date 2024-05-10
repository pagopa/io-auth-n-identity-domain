import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";

import { LollipopApi } from "../repositories";

import { log } from "../utils/logger";

import { AssertionRef } from "../generated/lollipop-api/AssertionRef";
import {
  GenericError,
  NotFoundError,
  UnauthorizedError,
  toGenericError,
  toNotFoundError,
  unauthorizedError,
} from "../models/domain-errors";
import { assertNever } from "../utils/errors";
import { LcParams } from "../generated/lollipop-api/LcParams";

export type GenerateLCParamsDeps = LollipopApi.LollipopApiDeps;
export type GenerateLCParamsErrors =
  | UnauthorizedError
  | NotFoundError
  | GenericError;

export const generateLCParams: (
  assertionRef: AssertionRef,
  operationId: NonEmptyString,
) => RTE.ReaderTaskEither<
  GenerateLCParamsDeps,
  GenerateLCParamsErrors,
  LcParams
> =
  (assertionRef, operationId) =>
  ({ lollipopApiClient }) =>
    pipe(
      TE.tryCatch(
        () =>
          lollipopApiClient.generateLCParams({
            assertion_ref: assertionRef,
            body: {
              operation_id: operationId,
            },
          }),
        E.toError,
      ),
      TE.mapLeft((err) => {
        log.error(
          "lollipopMiddleware|error trying to call the Lollipop function service [%s]",
          err.message,
        );
        return toGenericError("Error calling the Lollipop function service");
      }),
      TE.chainEitherKW(
        E.mapLeft(
          flow(readableReportSimplified, (message) =>
            toGenericError(
              `Unexpected response from lollipop service: ${message}`,
            ),
          ),
        ),
      ),
      TE.chainW((response) => {
        switch (response.status) {
          case 200:
            return TE.right<GenerateLCParamsErrors, LcParams>(response.value);
          case 403:
            return TE.left(unauthorizedError);
          case 404:
            return TE.left(toNotFoundError(LcParams.name));
          case 400:
          case 500:
            return TE.left(
              toGenericError("An error occurred on upstream service"),
            );
          default:
            return assertNever(response);
        }
      }),
    );
