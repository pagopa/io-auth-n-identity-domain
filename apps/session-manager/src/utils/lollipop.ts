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
import * as B from "fp-ts/lib/boolean";
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
import { withValidatedOrValidationError } from "../utils/responses";
import { NewPubKey } from "../generated/lollipop-api/NewPubKey";
import { LollipopApi } from "../repositories";
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
import { generateLCParams } from "../services/lollipop";
import { AssertionRefSha384 } from "../generated/lollipop-api/AssertionRefSha384";
import { AssertionRefSha512 } from "../generated/lollipop-api/AssertionRefSha512";
import { DomainErrorTypes } from "../models/domain-errors";
import { errorsToError } from "./errors";
import { ResLocals } from "./express";
import { withOptionalUserFromRequest } from "./user";
import { log } from "./logger";

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
    /* TODO: add event logging
     * operationId: NonEmptyString,
     */
    keyThumbprint: Thumbprint,
  ): RTE.ReaderTaskEither<
    { redisClientSelector: RedisClientSelectorType },
    IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
    AssertionRef
  > =>
  ({ redisClientSelector }) =>
    pipe(
      RedisSessionStorageService.getLollipopAssertionRefForUser({
        redisClientSelector,
        fiscalCode,
      }),
      // TODO: send error event if taskEither results to left
      TE.mapLeft((err) => {
        log.error(
          "lollipopMiddleware|error reading the assertionRef from redis [%s]",
          err.message,
        );
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
          // TODO: send error event if taskEither results to left
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
    {
      lollipopApiClient: LollipopApiClient;
      redisClientSelector: RedisClientSelectorType;
    },
    IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
    LollipopLocalsType
  > =>
  ({ lollipopApiClient, redisClientSelector }) =>
    pipe(
      TE.of(getNonceOrUlid(lollipopHeaders["signature-input"])),
      TE.bindTo("operationId"),
      TE.bind("keyThumbprint", ({ operationId: _operationId }) =>
        pipe(
          getKeyThumbprintFromSignature(lollipopHeaders["signature-input"]),
          // TODO: send error event if either results to left
          E.mapLeft(() =>
            ResponseErrorInternal("Invalid assertionRef in signature params"),
          ),
          TE.fromEither,
        ),
      ),
      TE.bind(
        "assertionRefSet",
        ({ keyThumbprint, operationId: _operationId }) =>
          pipe(
            O.fromNullable(fiscalCode),
            O.map((fc) =>
              pipe(
                getAndValidateAssertionRefForUser(
                  fc,
                  /* operationId, */
                  keyThumbprint,
                )({ redisClientSelector }),
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
              )({ lollipopApiClient }),
              // this swap has the purpose to interrupt the traversal if assertionRef was found
              TE.swap,
            ),
          ),
          // we have the left part with the found assertionRef, so we go forward
          // with a TE.right
          TE.foldW(TE.right, (domainErrors) =>
            // at the end of the traversal, if we didn't found the assertion ref we
            // return an error
            domainErrors.some((e) => e.kind === DomainErrorTypes.UNAUTHORIZED)
              ? TE.left<
                  IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized
                >(ResponseErrorForbiddenNotAuthorized)
              : TE.left(ResponseErrorInternal("Missing assertion ref")),
          ),
        ),
      ),
      TE.chainFirst(({ operationId: _operationId, lcParams, keyThumbprint }) =>
        pipe(
          O.fromNullable(fiscalCode),
          O.map(() => TE.of(true)),
          O.getOrElse(() =>
            pipe(
              getAndValidateAssertionRefForUser(
                lcParams.fiscal_code,
                /* operationId, */
                keyThumbprint,
              )({ redisClientSelector }),
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
      // TODO: info event of the sending data to the third party
    );

export const expressLollipopMiddleware: (
  lollipopApiClient: LollipopApiClient,
  redisClientSelector: RedisClientSelectorType,
) => (req: Request, res: Response, next: NextFunction) => Promise<void> =
  (lollipopApiClient, redisClientSelector) => (req, res, next) =>
    pipe(
      TE.tryCatch(
        () =>
          withOptionalUserFromRequest(req, async (user) =>
            withLollipopHeadersFromRequest(req, async (lollipopHeaders) =>
              pipe(
                extractLollipopLocalsFromLollipopHeaders(
                  lollipopHeaders,
                  O.toUndefined(user)?.fiscal_code,
                )({ lollipopApiClient, redisClientSelector }),
                TE.map((lollipopLocals) => {
                  // eslint-disable-next-line functional/immutable-data
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
