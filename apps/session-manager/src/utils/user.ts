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

export const withUserFromRequestRTE =
  <D extends WithExpressRequest, R extends IResponse<T>, T>(
    controller: RTE.ReaderTaskEither<D & WithUser, Error, R>,
  ): RTE.ReaderTaskEither<D, Error, IResponseErrorValidation | R> =>
  (deps3) =>
    withValidatedOrValidationErrorRTE(User.decode(deps3.req.user), (user) =>
      controller({
        user,
        ...deps3,
      }),
    );
