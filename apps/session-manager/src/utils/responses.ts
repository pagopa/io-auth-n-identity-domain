import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  ResponseErrorInternal,
  ResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { Task } from "fp-ts/Task";
import { pipe } from "fp-ts/lib/function";
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
 * Transforms async failures into internal errors
 * @deprecated
 */
export const withCatchAsInternalError = <T>(
  f: () => Promise<T>,
  message: string = "Exception while calling upstream API (likely a timeout).",
): Promise<T | IResponseErrorInternal> =>
  f().catch((_) => {
    // eslint-disable-next-line no-console
    log.error(_);
    return ResponseErrorInternal(`${message} [${_}]`);
  });

export const withLeftAsInternalError = <T>(
  te: TE.TaskEither<Error, T>,
  message: string = "Exception while calling upstream API (likely a timeout).",
): Task<T | IResponseErrorInternal> =>
  pipe(
    te,
    TE.mapLeft((err) => {
      log.error(err);
      return ResponseErrorInternal(`${message} [${err}]`);
    }),
    TE.toUnion,
  );

export const unhandledResponseStatus = (
  status: number,
): IResponseErrorInternal =>
  ResponseErrorInternal(`unhandled API response status [${status}]`);
