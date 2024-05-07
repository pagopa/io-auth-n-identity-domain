import { Either } from "fp-ts/lib/Either";
import { Errors } from "io-ts";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import * as express from "express";

/**
 * Validate the `ip` value into the express Request.
 * When the boolean flag "trust proxy" is enabled
 * express takes this from the leftmost value
 * contained in the x-forwarded-for header
 */
export const decodeIPAddressFromReq = (
  req: express.Request,
): Either<Errors, IPString> => IPString.decode(req.ip);
