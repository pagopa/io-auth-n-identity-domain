import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/lib/function";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import { IO } from "fp-ts/lib/IO";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";

import { IResponseType } from "@pagopa/ts-commons/lib/requests";
import { FnLollipopRepo, LollipopRevokeRepo } from "../repositories";

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
import { assertNever, errorsToError } from "../utils/errors";
import { LcParams } from "../generated/lollipop-api/LcParams";
import { RedisRepositoryDeps } from "../repositories/redis";
import { ActivatedPubKey } from "../generated/lollipop-api/ActivatedPubKey";
import { AssertionTypeEnum } from "../generated/lollipop-api/AssertionType";
import { AppInsightsDeps } from "../utils/appinsights";
import { RedisSessionStorageService } from ".";

const LOLLIPOP_ERROR_EVENT_NAME = "lollipop.error.acs";

export type GenerateLCParamsDeps = FnLollipopRepo.LollipopApiDeps;
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
  ({ fnLollipopAPIClient }) =>
    pipe(
      TE.tryCatch(
        () =>
          fnLollipopAPIClient.generateLCParams({
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

export const activateLolliPoPKey = (
  deps: {
    assertionRef: AssertionRef;
    fiscalCode: FiscalCode;
    assertion: NonEmptyString;
    getExpirePubKeyFn: IO<Date>;
  } & GenerateLCParamsDeps &
    AppInsightsDeps,
): TE.TaskEither<Error, ActivatedPubKey> =>
  pipe(
    TE.tryCatch(
      () =>
        deps.fnLollipopAPIClient.activatePubKey({
          assertion_ref: deps.assertionRef,
          body: {
            assertion: deps.assertion,
            assertion_type: AssertionTypeEnum.SAML,
            expired_at: deps.getExpirePubKeyFn(),
            fiscal_code: deps.fiscalCode,
          },
        }),
      (e) => {
        const error = E.toError(e);
        deps.appInsightsTelemetryClient?.trackEvent({
          name: LOLLIPOP_ERROR_EVENT_NAME,
          properties: {
            assertion_ref: deps.assertionRef,
            fiscal_code: sha256(deps.fiscalCode),
            message: `Error activating lollipop pub key | ${error.message}`,
          },
        });
        return error;
      },
    ),
    TE.chain(
      flow(
        TE.fromEither,
        TE.mapLeft((errors) => {
          const error = errorsToError(errors);
          deps.appInsightsTelemetryClient?.trackEvent({
            name: LOLLIPOP_ERROR_EVENT_NAME,
            properties: {
              assertion_ref: deps.assertionRef,
              fiscal_code: sha256(deps.fiscalCode),
              message: `Error activating lollipop pub key | ${error.message}`,
            },
          });
          return error;
        }),
      ),
    ),
    TE.chain(
      TE.fromPredicate(
        (res): res is IResponseType<200, ActivatedPubKey, never> =>
          res.status === 200,
        () =>
          new Error(
            "Error calling the function lollipop api for pubkey activation",
          ),
      ),
    ),
    TE.map((res) => res.value),
  );

export const deleteAssertionRefAssociation: (
  fiscalCode: FiscalCode,
  assertionRefToRevoke: AssertionRef,
  eventName: string,
  eventMessage: string,
) => RTE.ReaderTaskEither<
  LollipopRevokeRepo.RevokeAssertionRefDeps &
    RedisRepositoryDeps &
    AppInsightsDeps,
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
          message: "error sending revoke message for previous assertionRef",
        },
      });
      log.error(
        "error sending revoke message for previous assertionRef [%s]",
        err,
      );
    }),
  )().catch(() => void 0 as never); // This promise should never throw

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
