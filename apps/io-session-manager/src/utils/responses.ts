import {
  errorsToReadableMessages,
  readableReportSimplified,
} from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponsePermanentRedirect,
  ResponseErrorInternal,
  ResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as express from "express";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
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

/**
 * Returns a permanent redirect to a specific location
 * with an embedded Set-Cookie header
 * tailored to clear an existing cookie(if present)
 *
 * @param location The redirect location
 * @param cookieName the name of the cookie to clear
 * @param cookieOptions an express.CookieOptions type.
 * NOTE: Web browsers and other compliant clients will only clear the cookie
 * if the given options are identical to those given to res.cookie(),
 * excluding expires and maxAge.
 *
 */
export const withCookieClearanceResponsePermanentRedirect: (
  location: UrlFromString,
  cookieName: string,
  cookieOptions: express.CookieOptions,
) => IResponsePermanentRedirect = (location, cookieName, cookieOptions) => ({
  apply: (res: express.Response) =>
    res
      .clearCookie(cookieName, {
        ...cookieOptions,
        maxAge: undefined,
        expires: undefined,
      })
      .redirect(301, location.href),
  detail: location.href,
  kind: "IResponsePermanentRedirect",
});

/**
 * Returns a response describing an internal error
 * with an embedded Set-Cookie header
 * tailored to clear an existing cookie(if present)
 *
 * @param detail The error message
 * @param cookieName the name of the cookie to clear
 * @param cookieOptions an express.CookieOptions type.
 * NOTE: Web browsers and other compliant clients will only clear the cookie
 * if the given options are identical to those given to res.cookie(),
 * excluding expires and maxAge.
 *
 */
export const withCookieClearanceResponseErrorInternal: (
  detail: string,
  cookieName: string,
  cookieOptions: express.CookieOptions,
) => IResponseErrorInternal = (detail, cookieName, cookieOptions) => {
  const problem = {
    detail,
    status: 500,
    title: "Internal server error",
  };
  return {
    apply: (res) =>
      res
        .status(problem.status)
        .set("Content-Type", "application/problem+json")
        .clearCookie(cookieName, {
          ...cookieOptions,
          maxAge: undefined,
          expires: undefined,
        })
        .json(problem),
    detail: `${problem.title}: ${problem.detail}`,
    kind: "IResponseErrorInternal",
  };
};

/**
 * Returns a response describing a validation error
 * with an embedded Set-Cookie header
 * tailored to clear an existing cookie(if present)
 *
 * @param title The error title
 * @param detail The error detail
 * @param cookieName the name of the cookie to clear
 * @param cookieOptions an express.CookieOptions type.
 * NOTE: Web browsers and other compliant clients will only clear the cookie
 * if the given options are identical to those given to res.cookie(),
 * excluding expires and maxAge.
 *
 */
export const withCookieClearanceResponseErrorValidation: (
  title: string,
  detail: string,
  cookieName: string,
  cookieOptions: express.CookieOptions,
) => IResponseErrorValidation = (title, detail, cookieName, cookieOptions) => {
  const problem = {
    detail,
    status: 400,
    title,
  };
  return {
    apply: (res) =>
      res
        .status(problem.status)
        .set("Content-Type", "application/problem+json")
        .clearCookie(cookieName, {
          ...cookieOptions,
          maxAge: undefined,
          expires: undefined,
        })
        .json(problem),
    detail: `${problem.title}: ${problem.detail}`,
    kind: "IResponseErrorValidation",
  };
};

/**
 * Return an IResponseErrorForbiddenNotAuthorized with a default detail if not provided
 * and with an embedded Set-Cookie header
 * tailored to clear an existing cookie(if present)
 *
 * @param detail Optional detail
 * @param cookieName the name of the cookie to clear
 * @param cookieOptions an express.CookieOptions type.
 * NOTE: Web browsers and other compliant clients will only clear the cookie
 * if the given options are identical to those given to res.cookie(),
 * excluding expires and maxAge.
 *
 */
export const withCookieClearanceResponseForbidden: (
  cookieName: string,
  cookieOptions: express.CookieOptions,
  detail?: string,
) => IResponseErrorForbiddenNotAuthorized = (
  cookieName,
  cookieOptions,
  detail = "You do not have enough permission to complete the operation you requested",
) => {
  const problem = {
    detail,
    status: 403,
    title: "You are not allowed here",
  };
  return {
    apply: (res) =>
      res
        .status(problem.status)
        .set("Content-Type", "application/problem+json")
        .clearCookie(cookieName, {
          ...cookieOptions,
          maxAge: undefined,
          expires: undefined,
        })
        .json(problem),
    detail: `${problem.title}: ${problem.detail}`,
    kind: "IResponseErrorForbiddenNotAuthorized",
  };
};
