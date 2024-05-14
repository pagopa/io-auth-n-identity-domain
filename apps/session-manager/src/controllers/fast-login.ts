import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorUnauthorized,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorUnauthorized,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { flow, identity, pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";
import * as AP from "fp-ts/Apply";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import { GenerateNonceResponse } from "../generated/fast-login-api/GenerateNonceResponse";
import { assertNever, readableProblem } from "../utils/errors";
import { getFnFastLoginAPIClient } from "../repositories/fast-login-api";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  UserTokens,
  WalletToken,
  ZendeskToken,
} from "../types/token";
import { getNewTokenAsync } from "../services/token";
import { User } from "../types/user";
import { ResLocals } from "../utils/express";
import { withLollipopLocals } from "../utils/lollipop";
import { FastLoginResponse as LCFastLoginResponse } from "../generated/fast-login-api/FastLoginResponse";
import { makeProxyUserFromSAMLResponse } from "../utils/spid";
import { isBlockedUser, set } from "../services/redis-session-storage";
import { FastLoginResponse } from "../types/fast-login";
import { RedisClientSelectorType } from "../types/redis";
import { RedisRepositoryDeps } from "../repositories/redis";
import { WithIP } from "../utils/network";
import { SESSION_ID_LENGTH_BYTES, SESSION_TOKEN_LENGTH_BYTES } from "./session";

const generateSessionTokens = (
  userFiscalCode: FiscalCode,
  redisClientSelector: RedisClientSelectorType,
): TE.TaskEither<
  IResponseErrorInternal | IResponseErrorUnauthorized,
  UserTokens
> => {
  // note: since we have a bunch of async operations that don't depend on
  //       each other, we can run them in parallel
  const tokenTasks = {
    // authentication token for BPD
    bpd_token: () =>
      getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES) as Promise<BPDToken>,
    // authentication token for FIMS
    fims_token: () =>
      getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES) as Promise<FIMSToken>,
    // authentication token for MyPortal
    myportal_token: () =>
      getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES) as Promise<MyPortalToken>,
    // authentication token for app backend
    session_token: () =>
      getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES) as Promise<SessionToken>,
    // unique ID for tracking the user session
    session_tracking_id: () => getNewTokenAsync(SESSION_ID_LENGTH_BYTES),
    // authentication token for pagoPA
    wallet_token: () =>
      getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES) as Promise<WalletToken>,
    // authentication token for Zendesk
    zendesk_token: () =>
      getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES) as Promise<ZendeskToken>,
  };

  return pipe(
    // ask the session storage whether this user is blocked
    isBlockedUser({
      redisClientSelector,
      fiscalCode: userFiscalCode,
    }),
    TE.mapLeft(() => ResponseErrorInternal(`Error while validating user`)),
    TE.chainW((isUserBlocked) =>
      isUserBlocked
        ? TE.left(ResponseErrorUnauthorized("User is blocked"))
        : TE.right(true),
    ),
    // TODO: refactor this part, removing async token generation behaviour
    TE.chainW(() => pipe(tokenTasks, AP.sequenceS(T.ApplyPar), TE.fromTask)),
  );
};

const createSessionForUser = (
  user: User,
  redisClientSelector: RedisClientSelectorType,
  sessionTTL: number,
): TE.TaskEither<IResponseErrorInternal, true> =>
  pipe(
    // create a new session and delete the old one if present
    set(redisClientSelector, sessionTTL)(user),
    TE.mapLeft((err) =>
      ResponseErrorInternal(
        `Could not create user using session storage: ${err.message}`,
      ),
    ),
    TE.chain(
      TE.fromPredicate(identity, (value) =>
        ResponseErrorInternal(
          `Could not create user: session storage returned ${value} `,
        ),
      ),
    ),
    TE.map(() => true),
  );

// TODO: this is NOT NEEDED for the first release of fast-login, however
// it MUST BE implemented afterwards
const callLcSetSession = (): TE.TaskEither<IResponseErrorInternal, true> =>
  TE.of(true);

//
// Endpoints
//
export const generateNonceEndpoint: RTE.ReaderTaskEither<
  {
    fnFastLoginAPIClient: ReturnType<getFnFastLoginAPIClient>;
  },
  Error,
  IResponseSuccessJson<GenerateNonceResponse>
> = ({ fnFastLoginAPIClient }) =>
  pipe(
    TE.tryCatch(
      () => fnFastLoginAPIClient.generateNonce({}),
      (_) => Error("Error while calling fast-login service"),
    ),
    TE.chainEitherK(
      E.mapLeft(
        flow(readableReportSimplified, (message) =>
          Error(`Unexpected response from fast-login service: ${message}`),
        ),
      ),
    ),
    TE.chain((response) => {
      switch (response.status) {
        case 200:
          return TE.right(ResponseSuccessJson(response.value));
        case 401:
          return TE.left(Error("Underlying API fails with an unexpected 401"));
        case 500:
          return TE.left(Error(readableProblem(response)));
        case 502:
        case 504:
          return TE.left(Error("An error occurred on upstream service"));
        default:
          return assertNever(response);
      }
    }),
  );

type FastLoginDeps<T extends ResLocals> = {
  fnFastLoginAPIClient: ReturnType<getFnFastLoginAPIClient>;
  sessionTTL: number;
  locals?: T;
} & WithIP;

type FastLoginHandler = <T extends ResLocals>(
  deps: RedisRepositoryDeps & FastLoginDeps<T>,
) => TE.TaskEither<
  Error,
  | IResponseErrorUnauthorized
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseSuccessJson<FastLoginResponse>
>;

export const fastLoginEndpoint: FastLoginHandler = ({
  redisClientSelector,
  fnFastLoginAPIClient,
  sessionTTL,
  clientIP,
  locals,
}) =>
  pipe(
    locals,
    withLollipopLocals,
    E.mapLeft((__) => ResponseErrorInternal("Could not initialize Lollipop")),
    TE.fromEither,
    TE.bindTo("lollipopLocals"),
    TE.bind("userFiscalCode", ({ lollipopLocals }) =>
      TE.of(lollipopLocals["x-pagopa-lollipop-user-id"]),
    ),
    TE.bindW("client_response", ({ lollipopLocals }) =>
      pipe(
        TE.tryCatch(
          () =>
            fnFastLoginAPIClient.fastLogin({
              ...lollipopLocals,
              "x-pagopa-lv-client-ip": clientIP,
            }),
          (__) =>
            ResponseErrorInternal("Error while calling the Lollipop Consumer"),
        ),
        TE.chainEitherKW(
          E.mapLeft(
            flow(readableReportSimplified, (message) =>
              ResponseErrorInternal(
                `Unexpected Lollipop consumer response: ${message}`,
              ),
            ),
          ),
        ),
        TE.chainW((lcResponse) =>
          lcResponse.status === 200
            ? TE.right<
                IResponseErrorInternal | IResponseErrorUnauthorized,
                LCFastLoginResponse
              >(lcResponse.value)
            : lcResponse.status === 401
              ? TE.left(
                  ResponseErrorUnauthorized(
                    "Invalid signature or nonce expired",
                  ),
                )
              : TE.left(
                  ResponseErrorInternal(
                    `Error in Lollipop consumer. Response contains ${lcResponse.status} with title ${lcResponse.value.title} and detail ${lcResponse.value.detail}`,
                  ),
                ),
        ),
      ),
    ),
    TE.bindW("parsed_saml_response", ({ client_response }) =>
      pipe(
        client_response.saml_response,
        safeXMLParseFromString,
        TE.fromOption(() =>
          ResponseErrorInternal(
            "Could not parse saml response from Lollipop consumer",
          ),
        ),
      ),
    ),
    TE.bindW("tokens", ({ lollipopLocals }) =>
      generateSessionTokens(
        lollipopLocals["x-pagopa-lollipop-user-id"],
        redisClientSelector,
      ),
    ),
    TE.bindW("userWithoutTokens", ({ parsed_saml_response }) =>
      pipe(
        parsed_saml_response,
        makeProxyUserFromSAMLResponse,
        TE.fromEither,
        TE.mapLeft(() => ResponseErrorInternal("Could not create proxy user")),
      ),
    ),
    TE.chainFirstW(({ userWithoutTokens, tokens }) =>
      createSessionForUser(
        {
          ...userWithoutTokens,
          ...tokens,
        },
        redisClientSelector,
        sessionTTL,
      ),
    ),
    TE.chainFirstW(callLcSetSession),
    TE.chainEitherKW(({ tokens }) =>
      pipe(
        tokens.session_token,
        NonEmptyString.decode,
        E.mapLeft((errors) =>
          ResponseErrorInternal(
            `Could not decode session token|${readableReportSimplified(
              errors,
            )}`,
          ),
        ),
      ),
    ),
    TE.map((sessionToken) =>
      ResponseSuccessJson({
        token: sessionToken,
      }),
    ),
    // fallback to Error in case of 500 response, the ResponseErrorInternal will
    // be returned by toExpressHandler method
    // TODO: refactor error management for every endpoint
    TE.orElseW(
      flow(
        TE.fromPredicate(
          (error) => error.kind === "IResponseErrorUnauthorized",
          (errorInternal) => Error(errorInternal.detail),
        ),
        TE.map((err) => err as IResponseErrorUnauthorized),
      ),
    ),
    //
  );
