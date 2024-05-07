import {
  DEFAULT_LOLLIPOP_HASH_ALGORITHM,
  LollipopHashAlgorithm,
  LOLLIPOP_PUB_KEY_HASHING_ALGO_HEADER_NAME,
  LOLLIPOP_PUB_KEY_HEADER_NAME,
} from "@pagopa/io-spid-commons/dist/types/lollipop";
import {
  JwkPublicKey,
  JwkPublicKeyFromToken,
} from "@pagopa/ts-commons/lib/jwk";
import * as express from "express";
import * as appInsights from "applicationinsights";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Apply";
import * as B from "fp-ts/lib/boolean";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorValidation,
  ResponseErrorConflict,
  ResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import { IResponseType } from "@pagopa/ts-commons/lib/requests";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { LollipopContentDigest } from "../generated/lollipop/LollipopContentDigest";
import { JwkPubKeyToken } from "../generated/lollipop-api/JwkPubKeyToken";
import { AssertionType } from "../generated/fast-login-api/AssertionType";
import { AssertionRef } from "../generated/backend/AssertionRef";
import { LollipopOriginalURL } from "../generated/fast-login-api/LollipopOriginalURL";
import { LollipopMethod } from "../generated/fast-login-api/LollipopMethod";
import { LollipopSignatureInput } from "../generated/fast-login-api/LollipopSignatureInput";
import { LollipopSignature } from "../generated/fast-login-api/LollipopSignature";
import { withValidatedOrValidationError } from "../utils/responses";
import { NewPubKey } from "../generated/lollipop-api/NewPubKey";
import { LollipopApi } from "../repositories";
import { JwkPubKeyHashAlgorithmEnum } from "../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import { ResLocals } from "./express";
import { errorsToError } from "./errors";

const getLoginErrorEventName = "lollipop.error.get-login";

/**
 * 1. Read pubkey header
 * 2. Decode key
 * 2b. Return bad request
 * 3. Generate fingerprint
 * 4. Check if fingerprint is reserved
 * 4b. Return bad request if key is reserved
 * 5. Reserve fingerprint (store pubKey)
 */

const isReservePubKeyResponseSuccess = (
  res: IResponseType<number, unknown>,
): res is IResponseType<201, NewPubKey> => res.status === 201;

export const LollipopLoginParams = t.type({
  algo: LollipopHashAlgorithm,
  jwk: JwkPublicKey,
});
export type LollipopLoginParams = t.TypeOf<typeof LollipopLoginParams>;

export const lollipopLoginHandler =
  (
    isLollipopEnabled: boolean,
    lollipopApiClient: LollipopApi.LollipopApiClient,
    appInsightsTelemetryClient?: appInsights.TelemetryClient,
  ) =>
  async (
    req: express.Request,
  ): Promise<
    | IResponseErrorValidation
    | IResponseErrorInternal
    | IResponseErrorConflict
    | LollipopLoginParams
    | undefined
  > =>
    withValidatedOrValidationError(
      pipe(
        req.headers[LOLLIPOP_PUB_KEY_HEADER_NAME],
        O.fromNullable,
        O.map(JwkPublicKeyFromToken.decode),
        O.bindTo("jwk"),
        O.bind("algo", () =>
          pipe(
            req.headers[LOLLIPOP_PUB_KEY_HASHING_ALGO_HEADER_NAME],
            O.fromNullable,
            O.getOrElseW(() => DEFAULT_LOLLIPOP_HASH_ALGORITHM),
            O.of,
            O.map(LollipopHashAlgorithm.decode),
          ),
        ),
        O.map(A.sequenceS(E.Applicative)),
        O.getOrElseW(() => E.right(void 0)),
      ),
      (lollipopParams) =>
        pipe(
          isLollipopEnabled,
          B.fold(
            () => O.none,
            () =>
              pipe(
                lollipopParams,
                O.fromNullable,
                O.map(({ algo, jwk }) =>
                  pipe(
                    TE.tryCatch(
                      () =>
                        lollipopApiClient.reservePubKey({
                          body: {
                            algo: JwkPubKeyHashAlgorithmEnum[algo],
                            pub_key: jwk,
                          },
                        }),
                      (e) => {
                        const error = E.toError(e);
                        appInsightsTelemetryClient?.trackEvent({
                          name: getLoginErrorEventName,
                          properties: {
                            message: `Error calling reservePubKey endpoint: ${error.message}`,
                          },
                        });
                        return error;
                      },
                    ),
                    TE.mapLeft(() =>
                      ResponseErrorInternal(
                        "Error while calling reservePubKey API",
                      ),
                    ),
                    TE.chainEitherKW(
                      E.mapLeft((err) =>
                        pipe(
                          err,
                          errorsToError,
                          (e) => {
                            appInsightsTelemetryClient?.trackEvent({
                              name: getLoginErrorEventName,
                              properties: {
                                message: `Error calling reservePubKey endpoint: ${e.message}`,
                              },
                            });
                            return e;
                          },
                          () =>
                            ResponseErrorInternal(
                              "Cannot parse reserve response",
                            ),
                        ),
                      ),
                    ),
                    TE.filterOrElseW(
                      isReservePubKeyResponseSuccess,
                      (errorResponse) =>
                        errorResponse.status === 409
                          ? ResponseErrorConflict("PubKey is already reserved")
                          : ResponseErrorInternal("Cannot reserve pubKey"),
                    ),
                    TE.map(() => lollipopParams),
                    TE.toUnion,
                  )(),
                ),
              ),
          ),
          O.toUndefined,
        ),
    );

export const lollipopLoginMiddleware =
  (
    isLollipopEnabled: boolean,
    lollipopApiClient: LollipopApi.LollipopApiClient,
    appInsightsTelemetryClient?: appInsights.TelemetryClient,
  ) =>
  (
    req: express.Request,
  ): Promise<
    | IResponseErrorValidation
    | IResponseErrorInternal
    | IResponseErrorConflict
    | undefined
  > =>
    lollipopLoginHandler(
      isLollipopEnabled,
      lollipopApiClient,
      appInsightsTelemetryClient,
    )(req).then((_) => (LollipopLoginParams.is(_) ? undefined : _));

export const LollipopRequiredHeaders = t.intersection([
  t.type({
    signature: LollipopSignature,
    ["signature-input"]: LollipopSignatureInput,
    ["x-pagopa-lollipop-original-method"]: LollipopMethod,
    ["x-pagopa-lollipop-original-url"]: LollipopOriginalURL,
  }),
  t.partial({ ["content-digest"]: LollipopContentDigest }),
]);
export type LollipopRequiredHeaders = t.TypeOf<typeof LollipopRequiredHeaders>;

export const LollipopLocalsType = t.intersection([
  LollipopRequiredHeaders,
  t.type({
    ["x-pagopa-lollipop-assertion-ref"]: AssertionRef,
    ["x-pagopa-lollipop-assertion-type"]: AssertionType,
    ["x-pagopa-lollipop-auth-jwt"]: NonEmptyString,
    ["x-pagopa-lollipop-public-key"]: JwkPubKeyToken,
    ["x-pagopa-lollipop-user-id"]: FiscalCode,
  }),
  t.partial({
    body: t.any,
    ["content-digest"]: LollipopContentDigest,
  }),
]);
export type LollipopLocalsType = t.TypeOf<typeof LollipopLocalsType>;

/**
 * Utility function that validate locals to check if all
 * the properties required for lollipop are present.
 * The type guard is used to keep unchanged the original locals.
 * If the type doesn't match a IResponseErrorValidation is returned on left.
 *
 * @param locals express res.locals vars injected by toExpressHandler middleware
 */
export const withLollipopLocals = <T extends ResLocals>(
  locals?: T,
): E.Either<IResponseErrorValidation, LollipopLocalsType> =>
  pipe(
    locals,
    E.fromPredicate(LollipopLocalsType.is, () =>
      ResponseErrorValidation("Bad request", "Error initializiang lollipop"),
    ),
  );
