import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import * as express from "express";
import { reserve, ReserveDeps, ReserveOutput } from "../services/oidc";
import { ReserveInput } from "../types/oidc";
import { WithExpressRequest } from "../utils/express";
import { withValidatedOrValidationErrorRTE } from "../utils/responses";

/**
 * Decodes the JSON request body required by the `reserve` endpoint from the
 * express Request into a `ReserveInput`.
 */
const decodeReserveInput = (req: express.Request): t.Validation<ReserveInput> =>
  ReserveInput.decode({
    currentUser: req.body?.current_user,
    env: req.body?.env,
    jwk: req.body?.lollipop_pub_key,
    jwkPubKeyHashAlgorithm: req.body?.lollipop_hash_algo,
    loginType: req.body?.login_type,
    minAuthLevel: req.body?.min_auth_level,
  });

export type ReserveEndpointDeps = ReserveDeps & WithExpressRequest;

/**
 * Reserves the OneIdentity (OIDC) authorization request for the given
 * Lollipop public key, returning the parameters needed by the client to
 * start the login flow.
 */
export const reserveEndpoint: RTE.ReaderTaskEither<
  ReserveEndpointDeps,
  Error,
  ReserveOutput
> = (deps) =>
  withValidatedOrValidationErrorRTE(decodeReserveInput(deps.req), (input) =>
    TE.tryCatch(() => reserve(deps)(input), E.toError),
  );
