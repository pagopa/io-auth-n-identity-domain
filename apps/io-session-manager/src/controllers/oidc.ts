import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import * as express from "express";
import {
  CallbackDeps,
  CallbackOutput,
  OIDCCallback,
  reserve,
  ReserveDeps,
  ReserveOutput,
} from "../services/oidc";
import {
  CallbackErrorInput,
  CallbackSuccessInput,
  ReserveInput,
} from "../types/oidc";
import { WithExpressRequest } from "../utils/express";
import { withValidatedOrValidationErrorRTE } from "../utils/responses";
import {
  IResponsePermanentRedirect,
  ResponsePermanentRedirect,
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import { getAndDelete } from "../services/redis-ausiliar-data";
import { getClientErrorRedirectionUrl } from "../config/spid";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

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

/**
 * Errors are forwarded to callback endpoint in the form of query parameters
 * (e.g. ?error=access_denied&state=x&description=22).
 * This utility function decodes the error input and invalidates ausiliar data
 * with a fire & forget strategy
 *
 * NOTE:
 * - ensure that "error redirect" flag is enabled in the admin panel
 * - error query param is related to
 *   https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1
 */
const decodeAndForwardError = (
  deps: CallbackEndpointDeps,
): TE.TaskEither<IResponsePermanentRedirect, never> =>
  pipe(
    CallbackErrorInput.decode(deps.req.query),
    TE.fromEither,
    TE.fold(
      () =>
        TE.left(
          ResponsePermanentRedirect(
            getClientErrorRedirectionUrl({
              errorMessage: "error occurred" as NonEmptyString,
            }),
          ),
        ),
      (errorInput) =>
        pipe(
          // fire & forget get and delete ausiliar data
          getAndDelete(errorInput.state)(deps)().catch(void 0 as never),
          (_) =>
            TE.left(
              ResponsePermanentRedirect(
                getClientErrorRedirectionUrl({
                  errorCode: parseInt(errorInput.error_description || "0") || 0,
                  errorMessage: errorInput.error,
                }),
              ),
            ),
        ),
    ),
  );

const callbackEndpointMiddleware = (deps: CallbackEndpointDeps) =>
  pipe(
    CallbackSuccessInput.decode(deps.req.query),
    TE.fromEither,
    TE.orElseW((_) => decodeAndForwardError(deps)),
  );

export type CallbackEndpointDeps = CallbackDeps & WithExpressRequest;

/**
 * Landing endpoint for the OIDC authorization code flow, returning a fresh
 * session token or an error with a 302 redirect
 */
export const callbackEndpoint: RTE.ReaderTaskEither<
  CallbackEndpointDeps,
  Error,
  CallbackOutput
> = (deps) =>
  pipe(
    callbackEndpointMiddleware(deps),
    TE.fold(
      // resolves to a redirect with error details in query parameters
      TE.right,
      (callbackSuccessInput) =>
        TE.tryCatch(() => OIDCCallback(deps)(callbackSuccessInput), E.toError),
    ),
  );
