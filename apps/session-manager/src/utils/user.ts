import * as express from "express";
import { IResponseErrorValidation } from "@pagopa/ts-commons/lib/responses";
import { User } from "../types/user";
import { withValidatedOrValidationError } from "./responses";

export const withUserFromRequest = async <T>(
  req: express.Request,
  f: (user: User) => Promise<T>,
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(User.decode(req.user), f);
