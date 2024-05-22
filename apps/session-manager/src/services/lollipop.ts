import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/lib/function";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";

import { FnFastLoginRepo, LollipopRevokeRepo } from "../repositories";

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
import { RedisRepositoryDeps } from "../repositories/redis";
import { RedisSessionStorageService } from ".";

export type GenerateLCParamsDeps = FnFastLoginRepo.LollipopApiDeps;
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

export const deleteAssertionRefAssociation: (
  fiscalCode: FiscalCode,
  assertionRefToRevoke: AssertionRef,
  eventName: string,
  eventMessage: string,
) => RTE.ReaderTaskEither<
  LollipopRevokeRepo.RevokeAssertionRefDeps &
    RedisRepositoryDeps & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appInsightsTelemetryClient?: any;
    },
  Error,
  boolean
> = (fiscalCode, assertionRefToRevoke, eventName, eventMessage) => (deps) => {
  // Sending a revoke message for assertionRef
  // This operation is fire and forget
  pipe(
    LollipopRevokeRepo.revokePreviousAssertionRef(assertionRefToRevoke)(deps),
    TE.mapLeft((err) => {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: eventName,
        properties: {
          assertion_ref: assertionRefToRevoke,
          error: err,
          fiscal_code: sha256(fiscalCode),
          message:
            "acs: error sending revoke message for previous assertionRef",
        },
      });
      log.error(
        "acs: error sending revoke message for previous assertionRef [%s]",
        err,
      );
    }),
  )().catch(() => void 0); // This promise should never throw

  return pipe(
    RedisSessionStorageService.delLollipopDataForUser({
      ...deps,
      fiscalCode,
    }),
    TE.mapLeft((err) => {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: eventName + ".delete",
        properties: {
          error: err.message,
          fiscal_code: sha256(fiscalCode),
          message: eventMessage,
        },
      });
      return err;
    }),
  );
};
