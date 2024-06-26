import {
  errorsToReadableMessages,
  readableReportSimplified,
} from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  ResponseErrorInternal,
  ResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { log } from "./logger";

/**
 * Calls the provided function with the valid response, or else returns an
 * IResponseErrorValidation with the validation errors.
 * @deprecated
 */
export const withValidatedOrValidationError = <T, U>(
  response: t.Validation<T>,
  f: (p: T) => U,
): U | IResponseErrorValidation =>
  E.isLeft(response)
    ? ResponseErrorValidation(
        "Bad request",
        errorsToReadableMessages(response.left).join(" / "),
      )
    : f(response.right);

/**
 * Calls the provided function with the valid response, or else returns an
 * IResponseErrorValidation with the validation errors.
 */
export const withValidatedOrValidationErrorRTE = <T, U, E>(
  response: t.Validation<T>,
  f: (p: T) => TE.TaskEither<E, U>,
): TE.TaskEither<E, U | IResponseErrorValidation> =>
  E.isLeft(response)
    ? TE.right(
        ResponseErrorValidation(
          "Bad request",
          errorsToReadableMessages(response.left).join(" / "),
        ),
      )
    : f(response.right);

/**
 * Calls the provided function with the valid response, or else returns an
 * IResponseErrorInternal with the validation errors.
 * @deprecated use RTE variant instead
 */
export const withValidatedOrInternalError = <T, U>(
  validated: t.Validation<T>,
  f: (p: T) => U,
): U | IResponseErrorInternal =>
  E.isLeft(validated)
    ? ResponseErrorInternal(
        errorsToReadableMessages(validated.left).join(" / "),
      )
    : f(validated.right);

/**
 * Calls the provided function with the valid response, or else returns an
 * IResponseErrorInternal with the validation errors.
 */
export const withValidatedOrInternalErrorRTE = <T, U, E>(
  validated: t.Validation<T>,
  f: (p: T) => TE.TaskEither<E, U>,
): TE.TaskEither<E, U | IResponseErrorInternal> =>
  E.isLeft(validated)
    ? TE.right(ResponseErrorInternal(readableReportSimplified(validated.left)))
    : f(validated.right);

/**
 * Transforms async failures into internal errors
 * @deprecated
 */
export const withCatchAsInternalError = <T>(
  f: () => Promise<T>,
  message: string = "Exception while calling upstream API (likely a timeout).",
): Promise<T | IResponseErrorInternal> =>
  f().catch((_) => {
    log.error(_);
    return ResponseErrorInternal(`${message} [${_}]`);
  });

export const unhandledResponseStatus = (
  status: number,
): IResponseErrorInternal =>
  ResponseErrorInternal(`unhandled API response status [${status}]`);

export const ResponseErrorStatusNotDefinedInSpec = (response: never) =>
  // This case should not happen, so response is of type never.
  // However, the underlying api may not follow the specs so we might trace the unhandled status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unhandledResponseStatus((response as any).status);

export const ResponseErrorUnexpectedAuthProblem = () =>
  // This case can only happen because of misconfiguration, thus it might be considered an error
  ResponseErrorInternal("Underlying API fails with an unexpected 401");
