import * as express from "express";
import {
  IResponse,
  IResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as TE from "fp-ts/TaskEither";
import { User } from "../types/user";
import {
  withValidatedOrValidationError,
  withValidatedOrValidationErrorRTE,
} from "./responses";
import { WithExpressRequest } from "./express";

/**
 * @deprecated
 */
export const withUserFromRequest = async <T>(
  req: express.Request,
  f: (user: User) => Promise<T>,
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(User.decode(req.user), f);

export type WithUser = {
  user: User;
};

export const withUserFromRequestRTE =
  <D extends WithExpressRequest, R extends IResponse<T>, T>(
    controller: (deps2: D & WithUser) => TE.TaskEither<Error, R>,
  ) =>
  (deps3: D): TE.TaskEither<Error, IResponseErrorValidation | R> =>
    withValidatedOrValidationErrorRTE(User.decode(deps3.req.user), (user) =>
      controller({
        user,
        ...deps3,
      }),
    );
