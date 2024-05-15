import {
  IResponse,
  IResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import express from "express";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { User } from "../types/user";
import {
  withValidatedOrValidationError,
  withValidatedOrValidationErrorRTE,
} from "./responses";
import { WithExpressRequest } from "./express";

export type WithUser = {
  user: User;
};

/**
 * Extends the RTE dependencies in input with the User retrieved
 * from the express Request and pass they to an hendler. If the user is missing or
 * malformed a validation error is returned.
 * @param controllerHandler The handler of the API requests
 */
export const withUserFromRequest =
  <D extends WithExpressRequest, R extends IResponse<T>, T>(
    controllerHandler: RTE.ReaderTaskEither<D & WithUser, Error, R>,
  ): RTE.ReaderTaskEither<D, Error, IResponseErrorValidation | R> =>
  (deps) =>
    withValidatedOrValidationErrorRTE(User.decode(deps.req.user), (user) =>
      controllerHandler({
        user,
        ...deps,
      }),
    );

export const withOptionalUserFromRequest = async <T>(
  req: express.Request,
  f: (user: O.Option<User>) => Promise<T>,
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(
    req.user ? pipe(User.decode(req.user), E.map(O.some)) : E.right(O.none),
    f,
  );
