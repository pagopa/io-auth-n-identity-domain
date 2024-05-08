import {
  IResponse,
  IResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import { User } from "../types/user";
import { withValidatedOrValidationErrorRTE } from "./responses";
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
