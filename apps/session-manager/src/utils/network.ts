import { Either } from "fp-ts/lib/Either";
import { Errors, array } from "io-ts";
import { CIDR, IPString } from "@pagopa/ts-commons/lib/strings";
import * as rangeCheck from "range_check";
import * as express from "express";
import {
  IResponse,
  IResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { WithExpressRequest } from "./express";
import { withValidatedOrInternalErrorRTE } from "./responses";
import { log } from "./logger";

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

/**
 * Parse a comma separated string of CIDR(s) or IP(s) into an array
 */
export const decodeCIDRs = (
  cidrs?: string,
): Either<Errors, ReadonlyArray<CIDR>> =>
  array(CIDR).decode(
    cidrs
      // may be a comma separated list of CIDR(s) or IP(s)
      ?.split(",")
      .map((c) => c.trim())
      // if we read a plain IP then append '/32'
      .map((c) => (c.indexOf("/") !== -1 ? c : c + "/32")),
  );

/**
 * An Express middleware that checks if source IP falls into a CIDR range.
 * This middleware may need trust proxy enabled in express to work properly with
 * proxy
 */
export const checkIP =
  (range: ReadonlyArray<CIDR>) =>
  (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void =>
    pipe(
      decodeIPAddressFromReq(req),
      E.alt(() =>
        // use x-client-ip instead of x-forwarded-for
        // for internal calls (same vnet)
        IPString.decode(req.headers["x-client-ip"]),
      ),
      E.mapLeft((errors) => {
        log.error(
          `Cannot decode source IP: (req.ip=${req.ip},x-client-ip=${
            req.headers["x-client-ip"]
          },error=${readableReportSimplified(errors)}.`,
        );
        res.status(400).send("Bad request");
      }),
      E.chain(
        E.fromPredicate(
          (IP) => rangeCheck.inRange(IP, Array.from(range)),
          (unexpectedIP) => {
            log.error(`Blocked source IP ${unexpectedIP}.`);
            res.status(401).send("Unauthorized");
          },
        ),
      ),
      E.map(() => next()),
      E.toUnion,
    );
