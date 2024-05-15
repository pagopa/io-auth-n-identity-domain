import { Either } from "fp-ts/lib/Either";
import { Errors } from "io-ts";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import * as express from "express";
import {
  IResponse,
  IResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import { WithExpressRequest } from "./express";
import { withValidatedOrInternalErrorRTE } from "./responses";

/**
 * Validate the `ip` value into the express Request.
 * When the boolean flag "trust proxy" is enabled
 * express takes this from the leftmost value
 * contained in the x-forwarded-for header
 */
const decodeIPAddressFromReq = (
  req: express.Request,
): Either<Errors, IPString> => IPString.decode(req.ip);

export type WithIP = {
  clientIP: IPString;
};

/**
 * Extends the RTE dependencies in input with the User retrieved
 * from the express Request and pass they to an hendler. If the user is missing or
 * malformed a validation error is returned.
 * @param controllerHandler The handler of the API requests
 */
export const withIPFromRequest =
  <D extends WithExpressRequest, R extends IResponse<T>, T>(
    controllerHandler: RTE.ReaderTaskEither<D & WithIP, Error, R>,
  ): RTE.ReaderTaskEither<D, Error, IResponseErrorInternal | R> =>
  (deps) =>
    withValidatedOrInternalErrorRTE(
      decodeIPAddressFromReq(deps.req),
      (clientIP) =>
        controllerHandler({
          clientIP,
          ...deps,
        }),
    );
