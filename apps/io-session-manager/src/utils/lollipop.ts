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
import { flow, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Apply";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as t from "io-ts";
import { IResponseType } from "@pagopa/ts-commons/lib/requests";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  ResponseErrorConflict,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import { NextFunction, Request, Response } from "express";
import { ulid } from "ulid";
import { Errors } from "io-ts";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import { calculateJwkThumbprint } from "jose";
import { withValidatedOrValidationError } from "../utils/responses";
import { NewPubKey } from "../generated/lollipop-api/NewPubKey";
import { FnLollipopRepo, RedisRepo } from "../repositories";
import { JwkPubKeyHashAlgorithmEnum } from "../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import {
  LollipopLocalsType,
  LollipopRequiredHeaders,
  Thumbprint,
} from "../types/lollipop";
import { LollipopApiClient } from "../repositories/lollipop-api";
import { LollipopSignatureInput } from "../generated/fast-login-api/LollipopSignatureInput";
import { AssertionRef } from "../generated/lollipop-api/AssertionRef";
import { JwkPubKeyHashAlgorithm } from "../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import { AssertionRefSha256 } from "../generated/lollipop-api/AssertionRefSha256";
import { RedisSessionStorageService } from "../services";
import { RedisClientSelectorType } from "../types/redis";
import {
  LOLLIPOP_SIGN_ERROR_EVENT_NAME,
  generateLCParams,
} from "../services/lollipop";
import { AssertionRefSha384 } from "../generated/lollipop-api/AssertionRefSha384";
import { AssertionRefSha512 } from "../generated/lollipop-api/AssertionRefSha512";
import { LcParams } from "../generated/lollipop-api/LcParams";
import { DomainErrorTypes, isUnauthorizedError } from "../models/domain-errors";
import {
  VALIDATION_COOKIE_NAME,
  VALIDATION_COOKIE_SETTINGS,
} from "../config/validation-cookie";
import { errorsToError } from "./errors";
import { ResLocals } from "./express";
import { withOptionalUserFromRequest } from "./user";
import { log } from "./logger";
import { AppInsightsDeps } from "./appinsights";

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
    lollipopApiClient: FnLollipopRepo.LollipopApiClient,
    appInsightsTelemetryClient?: appInsights.TelemetryClient,
  ) =>
  async (
    req: express.Request,
    res: express.Response,
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
                    tagOverrides: { samplingEnabled: "false" },
                  });
                  return error;
                },
              ),
              TE.mapLeft(() =>
                ResponseErrorInternal("Error while calling reservePubKey API"),
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
                        tagOverrides: { samplingEnabled: "false" },
                      });
                      return e;
                    },
                    () =>
                      ResponseErrorInternal("Cannot parse reserve response"),
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
              TE.chainW(() =>
                pipe(
                  TE.tryCatch(() => calculateJwkThumbprint(jwk), E.toError),
                  TE.map((thumbprint) => {
                    res.cookie(
                      VALIDATION_COOKIE_NAME,
                      `${algo}-${thumbprint}`,
                      VALIDATION_COOKIE_SETTINGS,
                    );
                  }),
                  TE.mapLeft(() =>
                    ResponseErrorInternal("Cannot set cookie value"),
                  ),
                ),
              ),
              TE.map(() => lollipopParams),
              TE.toUnion,
            )(),
          ),
          O.toUndefined,
        ),
    );

export const lollipopLoginMiddleware =
  (
    lollipopApiClient: FnLollipopRepo.LollipopApiClient,
    appInsightsTelemetryClient?: appInsights.TelemetryClient,
  ) =>
  (
    req: express.Request,
    res: express.Response,
  ): Promise<
    | IResponseErrorValidation
    | IResponseErrorInternal
    | IResponseErrorConflict
    | undefined
  > =>
    lollipopLoginHandler(lollipopApiClient, appInsightsTelemetryClient)(
      req,
      res,
    ).then((_) => (LollipopLoginParams.is(_) ? undefined : _));

const NONCE_REGEX = new RegExp(';?nonce="([^"]+)";?');
// Take the first occurrence of the field keyid into the signature-params
const KEY_ID_REGEX = new RegExp(';?keyid="([^"]+)";?');

const getNonceOrUlid = (
  lollipopSignatureInput: LollipopSignatureInput,
): NonEmptyString => {
  // The nonce value must be the first regex group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, nonce, ...__] = NONCE_REGEX.exec(lollipopSignatureInput) ?? [
    null,
    ulid(),
  ];
  return nonce as NonEmptyString;
};

export const algoToAssertionRefSet = new Set([
  { algo: JwkPubKeyHashAlgorithmEnum.sha256, type: AssertionRefSha256 },
  { algo: JwkPubKeyHashAlgorithmEnum.sha384, type: AssertionRefSha384 },
  { algo: JwkPubKeyHashAlgorithmEnum.sha512, type: AssertionRefSha512 },
]);

const getAlgoFromAssertionRef = (
  assertionRef: AssertionRef,
): JwkPubKeyHashAlgorithm =>
  pipe(
    Array.from(algoToAssertionRefSet),
    (ar) => ar.find((entry) => entry.type.is(assertionRef)),
    O.fromNullable,
    O.map((pubKeyHashAlgo) => pubKeyHashAlgo.algo),
    O.getOrElseW(() => void 0 as never),
  );

const getKeyThumbprintFromSignature = (
  lollipopSignatureInput: LollipopSignatureInput,
): E.Either<Errors, Thumbprint> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, thumbprint, ...__] = KEY_ID_REGEX.exec(lollipopSignatureInput) ?? [
    null,
    null,
  ];
  return Thumbprint.decode(thumbprint);
};

const getAndValidateAssertionRefForUser =
  (
    fiscalCode: FiscalCode,
    operationId: NonEmptyString,
    keyThumbprint: Thumbprint,
  ): RTE.ReaderTaskEither<
    RedisRepo.RedisRepositoryDeps & AppInsightsDeps,
    IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
    AssertionRef
  > =>
  ({ redisClientSelector, appInsightsTelemetryClient }) =>
    pipe(
      RedisSessionStorageService.getLollipopAssertionRefForUser({
        redisClientSelector,
        fiscalCode,
      }),
      TE.mapLeft((err) => {
        log.error(
          "lollipopMiddleware|error reading the assertionRef from redis [%s]",
          err.message,
        );
        appInsightsTelemetryClient?.trackEvent({
          name: `An error occurs retrieving the assertion ref from Redis | ${err.message}`,
          properties: {
            fiscal_code: sha256(fiscalCode),
            name: LOLLIPOP_SIGN_ERROR_EVENT_NAME,
            operation_id: operationId,
          },
          tagOverrides: { samplingEnabled: "false" },
        });
        return ResponseErrorInternal("Error retrieving the assertionRef");
      }),
      TE.chainW(TE.fromOption(() => ResponseErrorForbiddenNotAuthorized)),
      TE.chainW(
        flow(
          TE.fromPredicate(
            (assertionRef) =>
              assertionRef ===
              `${getAlgoFromAssertionRef(assertionRef)}-${keyThumbprint}`,
            () => ResponseErrorForbiddenNotAuthorized,
          ),
          TE.mapLeft((error) => {
            appInsightsTelemetryClient?.trackEvent({
              name: `AssertionRef is different from stored one`,
              properties: {
                fiscal_code: sha256(fiscalCode),
                name: LOLLIPOP_SIGN_ERROR_EVENT_NAME,
                operation_id: operationId,
              },
              tagOverrides: { samplingEnabled: "false" },
            });
            return error;
          }),
        ),
      ),
    );

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

/**
 * Take a express request and returns in callback validated
 * lollipop required headers with an `exact` decoding, stripping away
 * additional headers.
 * If the validation fails a IResponseErrorValidation is returned.
 *
 * @param req the express Request
 * @param f the callback
 */
const withLollipopHeadersFromRequest = async <T>(
  req: Request,
  f: (lollipopHeaders: LollipopRequiredHeaders) => Promise<T>,
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(
    t.exact(LollipopRequiredHeaders).decode(req.headers),
    f,
  );

export const extractLollipopLocalsFromLollipopHeaders =
  (
    lollipopHeaders: LollipopRequiredHeaders,
    fiscalCode?: FiscalCode,
  ): RTE.ReaderTaskEither<
    FnLollipopRepo.LollipopApiDeps &
      RedisRepo.RedisRepositoryDeps &
      AppInsightsDeps,
    IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
    LollipopLocalsType
  > =>
  ({ fnLollipopAPIClient, redisClientSelector, appInsightsTelemetryClient }) =>
    pipe(
      TE.of(getNonceOrUlid(lollipopHeaders["signature-input"])),
      TE.bindTo("operationId"),
      TE.bind("keyThumbprint", ({ operationId }) =>
        pipe(
          getKeyThumbprintFromSignature(lollipopHeaders["signature-input"]),
          E.mapLeft(() => {
            appInsightsTelemetryClient?.trackEvent({
              name: "AssertionRef in signature-input is missing or invalid",
              properties: {
                fiscal_code: fiscalCode ? sha256(fiscalCode) : undefined,
                name: LOLLIPOP_SIGN_ERROR_EVENT_NAME,
                operation_id: operationId,
              },
              tagOverrides: { samplingEnabled: "false" },
            });
            return ResponseErrorInternal(
              "Invalid assertionRef in signature params",
            );
          }),
          TE.fromEither,
        ),
      ),
      TE.bind("assertionRefSet", ({ keyThumbprint, operationId }) =>
        pipe(
          O.fromNullable(fiscalCode),
          O.map((fc) =>
            pipe(
              getAndValidateAssertionRefForUser(
                fc,
                operationId,
                keyThumbprint,
              )({ redisClientSelector, appInsightsTelemetryClient }),
              TE.map((assertionRef) => [assertionRef]),
            ),
          ),
          O.getOrElse(() =>
            TE.of([
              `sha256-${keyThumbprint}` as AssertionRef,
              `sha384-${keyThumbprint}` as AssertionRef,
              `sha512-${keyThumbprint}` as AssertionRef,
            ]),
          ),
        ),
      ),
      TE.bindW("lcParams", ({ assertionRefSet, operationId }) =>
        pipe(
          assertionRefSet,
          RA.traverse(TE.ApplicativeSeq)((assertionRef) =>
            pipe(
              generateLCParams(
                assertionRef,
                operationId,
              )({ fnLollipopAPIClient, appInsightsTelemetryClient }),
              TE.orElseW((err) =>
                err.kind === DomainErrorTypes.NOT_FOUND
                  ? TE.left(err)
                  : TE.right(err),
              ),
              // this swap has the purpose to interrupt the traversal if assertionRef was found or an error occurred
              TE.swap,
            ),
          ),
          TE.fold(
            (lcParamsOrError) =>
              LcParams.is(lcParamsOrError)
                ? TE.right(lcParamsOrError)
                : isUnauthorizedError(lcParamsOrError)
                  ? TE.left(ResponseErrorForbiddenNotAuthorized)
                  : TE.left<
                      | IResponseErrorForbiddenNotAuthorized
                      | IResponseErrorInternal,
                      LcParams
                    >(
                      ResponseErrorInternal(
                        "An error occurred generating LcParams",
                      ),
                    ),
            () =>
              // at the end of the traversal, if we didn't found the assertion ref we
              // return Forbidden
              TE.left(ResponseErrorForbiddenNotAuthorized),
          ),
        ),
      ),
      TE.chainFirst(({ operationId, lcParams, keyThumbprint }) =>
        pipe(
          O.fromNullable(fiscalCode),
          O.map(() => TE.of(true)),
          O.getOrElse(() =>
            pipe(
              getAndValidateAssertionRefForUser(
                lcParams.fiscal_code,
                operationId,
                keyThumbprint,
              )({ redisClientSelector, appInsightsTelemetryClient }),
              TE.map(() => true),
            ),
          ),
        ),
      ),
      TE.map(
        ({ lcParams }) =>
          ({
            ["x-pagopa-lollipop-assertion-ref"]: lcParams.assertion_ref,
            ["x-pagopa-lollipop-assertion-type"]: lcParams.assertion_type,
            ["x-pagopa-lollipop-auth-jwt"]: lcParams.lc_authentication_bearer,
            ["x-pagopa-lollipop-public-key"]: lcParams.pub_key,
            // It's possible to improve security by verifying that the fiscal code from
            // the authorization is equal to the one from the lollipop function
            ["x-pagopa-lollipop-user-id"]: fiscalCode || lcParams.fiscal_code,
            ...lollipopHeaders,
          }) as LollipopLocalsType,
      ),
      TE.map((lcLocals) => {
        appInsightsTelemetryClient?.trackEvent({
          name: "Lollipop locals to be sent to third party api",
          properties: {
            ...Object.keys(lcLocals),
            name: "lollipop.locals.info",
          },
          tagOverrides: { samplingEnabled: "false" },
        });
        return lcLocals;
      }),
    );

export const expressLollipopMiddleware: (
  lollipopApiClient: LollipopApiClient,
  redisClientSelector: RedisClientSelectorType,
  appInsightsTelemetryClient?: appInsights.TelemetryClient,
) => (req: Request, res: Response, next: NextFunction) => Promise<void> =
  (fnLollipopAPIClient, redisClientSelector, appInsightsTelemetryClient) =>
  (req, res, next) =>
    pipe(
      TE.tryCatch(
        () =>
          withOptionalUserFromRequest(req, async (user) =>
            withLollipopHeadersFromRequest(req, async (lollipopHeaders) =>
              pipe(
                extractLollipopLocalsFromLollipopHeaders(
                  lollipopHeaders,
                  O.toUndefined(user)?.fiscal_code,
                )({
                  fnLollipopAPIClient,
                  redisClientSelector,
                  appInsightsTelemetryClient,
                }),
                TE.map((lollipopLocals) => {
                
                  res.locals = { ...res.locals, ...lollipopLocals };
                }),
                TE.toUnion,
              )(),
            ),
          ),
        (err) => {
          log.error(
            "lollipopMiddleware|error executing the middleware [%s]",
            E.toError(err).message,
          );
          return ResponseErrorInternal("Error executing middleware");
        },
      ),
      TE.chain((maybeErrorResponse) =>
        maybeErrorResponse === undefined
          ? TE.of(void 0)
          : TE.left(maybeErrorResponse),
      ),
      TE.mapLeft((response) => response.apply(res)),
      TE.map(() => next()),
      TE.toUnion,
    )();
