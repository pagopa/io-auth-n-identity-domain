import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import * as express from "express";
import { reserve, ReserveDeps, ReserveOutput } from "../services/oidc";
import { ReserveInput } from "../types/oidc";
import { WithExpressRequest } from "../utils/express";
import { withValidatedOrValidationErrorRTE } from "../utils/responses";

const JWK_PUB_KEY_HEADER_NAME = "x-pagopa-lollipop-pub-key";
const JWK_PUB_KEY_HASH_ALGO_HEADER_NAME = "x-pagopa-lollipop-pub-key-hash-algo";
const LOGIN_TYPE_HEADER_NAME = "x-pagopa-login-type";
const CURRENT_USER_HEADER_NAME = "x-pagopa-current-user";

/**
 * Decodes the query params and headers required by the `reserve` endpoint
 * from the express Request into a `ReserveInput`.
 */
const decodeReserveInput = (req: express.Request): t.Validation<ReserveInput> =>
  ReserveInput.decode({
    authLevel: req.query.authLevel,
    currentUser: req.header(CURRENT_USER_HEADER_NAME),
    env: req.query.env,
    jwk: req.header(JWK_PUB_KEY_HEADER_NAME),
    jwkPubKeyHashAlgorithm: req.header(JWK_PUB_KEY_HASH_ALGO_HEADER_NAME),
    loginType: req.header(LOGIN_TYPE_HEADER_NAME),
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
