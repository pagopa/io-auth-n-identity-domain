import type * as client from "openid-client" with { "resolution-mode": "import" };
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { calculateJwkThumbprint } from "jose";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorValidation,
  ResponsePermanentRedirect,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import {
  getOneIdEnvConfig,
  LOGIN_AUSILIAR_DATA_TTL_SECONDS,
  OidcEnvConfig,
  ONEID_HTTP_TIMEOUT_SECONDS,
} from "../config/one-id";
import { AssertionRef } from "../generated/lollipop-api/AssertionRef";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { RedisRepo } from "../repositories";
import {
  exchangeAuthorizationCode,
  getOidcConfiguration,
} from "../repositories/oidc-client";
import {
  CallbackSuccessInput,
  ExchangeCodeAPIResponse,
  LoginAusiliarData,
  ReserveInput,
} from "../types/oidc";
import { getAndDelete, save } from "./redis-ausiliar-data";
import { getNewTokenAsync } from "./token";
import { UrlFromString, ValidUrl } from "@pagopa/ts-commons/lib/url";
import { AppInsightsDeps } from "../utils/appinsights";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { ReserveResponse } from "../generated/backend/ReserveResponse";
import { AssertionConsumerServiceT } from "@pagopa/io-spid-commons";
import { AcsDependencies } from "../controllers/authentication";
import { getClientProfileRedirectionUrl } from "../config/spid";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";

export type ReserveDeps = RedisRepo.RedisRepositoryDeps & AppInsightsDeps;

export type ReserveOutput =
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseSuccessJson<ReserveResponse>;

/**
 * Reserves an OIDC authorization request and returns the parameters needed to start the
 * login flow with the selected OneIdentity environment.
 *
 * The Lollipop public key is expected to have already been reserved by
 * `lollipopLoginMiddleware`, mounted upstream of
 * this endpoint as a plain express middleware.
 */
export const reserve =
  (deps: ReserveDeps) =>
  async (input: ReserveInput): Promise<ReserveOutput> => {
    const envConfigResult = getOneIdEnvConfig(input.env);
    if (E.isLeft(envConfigResult)) {
      return ResponseErrorValidation(
        "Bad request",
        envConfigResult.left.message,
      );
    }
    const envConfig = envConfigResult.right;

    // NOTE: The public key has already been reserved (and the assertion ref
    // computed the same way) by `lollipopLoginMiddleware`, so we only need
    // to recompute the same assertion ref here to persist it in the
    // ausiliar data.
    const jwkThumbprint = await calculateJwkThumbprint(
      input.jwk,
      input.jwkPubKeyHashAlgorithm,
    );
    const lollipopAssertionRef =
      `${input.jwkPubKeyHashAlgorithm}-${jwkThumbprint}` as AssertionRef;

    const state = (await getNewTokenAsync(24)) as NonEmptyString;
    const nonce = (await getNewTokenAsync(24)) as NonEmptyString;

    let oidcConfiguration;
    try {
      oidcConfiguration = await getOidcConfiguration(
        input.env,
        envConfig,
        ONEID_HTTP_TIMEOUT_SECONDS,
      );
    } catch (err) {
      // reserve operation is retriable, therefore this event can follow
      // sampling strategy
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.reserve.discovery.error",
        properties: {
          env: input.env,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      return ResponseErrorInternal(`OIDC discovery failed`);
    }

    const errorOrAuthorizationEndpoint = UrlFromString.decode(
      oidcConfiguration.serverMetadata().authorization_endpoint,
    );

    if (E.isLeft(errorOrAuthorizationEndpoint)) {
      // reserve operation is retriable, therefore this event can follow
      // sampling strategy
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.reserve.auth-decode.error",
        properties: {
          env: input.env,
          errorMessage: readableReportSimplified(
            errorOrAuthorizationEndpoint.left,
          ),
        },
      });
      return ResponseErrorInternal(`Could not parse auth endpoint`);
    }

    const ausiliarData: LoginAusiliarData = {
      clientId: envConfig.clientId,
      currentUser: input.currentUser,
      lollipopAssertionRef,
      loginType: input.loginType,
      minAuthLevel: input.minAuthLevel,
      nonce,
      oidcConfigurationEnv: input.env,
    };

    const saveResult = await save(
      state,
      ausiliarData,
      LOGIN_AUSILIAR_DATA_TTL_SECONDS,
    )(deps)();
    if (E.isLeft(saveResult)) {
      // reserve operation is retriable, therefore this event can follow
      // sampling strategy
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.reserve.ausiliar-data.error",
        properties: {
          env: input.env,
          errorMessage: saveResult.left.message,
        },
      });
      return ResponseErrorInternal(`Could not save ausiliar data`);
    }

    return ResponseSuccessJson({
      client_id: envConfig.clientId,
      authorization_endpoint: errorOrAuthorizationEndpoint.right
        .href as NonEmptyString,
      nonce,
      redirect_uri: envConfig.redirectUri.href as NonEmptyString,
      state,
    });
  };

export type CallbackOutput = Awaited<
  ReturnType<AssertionConsumerServiceT<Record<string, unknown>>>
>;

export type CallbackDeps = AcsDependencies & OneIdRepo.OneIdAPIRepositoryDeps;

export type ResolvedOidcConfiguration = {
  envConfig: OidcEnvConfig;
  oidcConfiguration: client.Configuration;
};

export const getLoginAusiliarData =
  (deps: RedisRepo.RedisRepositoryDeps) =>
  (state: NonEmptyString): Promise<E.Either<Error, LoginAusiliarData>> =>
    pipe(
      getAndDelete(state)(deps),
      TE.chainEitherKW(
        E.fromOption(
          () => new Error("Missing or expired OIDC login ausiliar data"),
        ),
      ),
    )();

export const resolveOidcEnvConfiguration = async (
  env: OidcConfigurationEnv,
): Promise<E.Either<Error, ResolvedOidcConfiguration>> => {
  const envConfigResult = getOneIdEnvConfig(env);
  if (E.isLeft(envConfigResult)) {
    return envConfigResult;
  }
  const envConfig = envConfigResult.right;

  try {
    const oidcConfiguration = await getOidcConfiguration(
      env,
      envConfig,
      ONEID_HTTP_TIMEOUT_SECONDS,
    );
    return E.right({ envConfig, oidcConfiguration });
  } catch (err) {
    return E.left(err instanceof Error ? err : new Error(String(err)));
  }
};

export const exchangeCode = async (
  oidcConfiguration: client.Configuration,
  envConfig: OidcEnvConfig,
  ausiliarData: LoginAusiliarData,
  input: CallbackSuccessInput,
): Promise<E.Either<Error, ExchangeCodeAPIResponse>> => {
  const currentUrl = new URL(envConfig.redirectUri.href);
  currentUrl.searchParams.set("code", input.code);
  currentUrl.searchParams.set("state", input.state);

  try {
    // NOTE: With this config, verifications are done by the library:
    // 1. using provider's public keys (JWKS, referenced via oidcConfiguration)
    //    it verifies the JWT signature
    // 2. does JWT expiration checks
    // 3. verifies that audience (aud field) is conform to our clientid
    // 4. verifies that iss matches the provider
    // 5. ensures nonce inside claims is the expected one
    const tokenResponse = await exchangeAuthorizationCode(
      oidcConfiguration,
      currentUrl,
      {
        expectedNonce: ausiliarData.nonce,
        expectedState: input.state,
        idTokenExpected: true,
      },
    );
    return pipe(
      tokenResponse,
      ExchangeCodeAPIResponse.decode,
      E.mapLeft(
        (err) =>
          new Error(
            `Could not decode OIDC exchange code API response: ${readableReportSimplified(err)}`,
          ),
      ),
    );
  } catch (err) {
    return E.left(err instanceof Error ? err : new Error(String(err)));
  }
};

export const getSAMLAssertion = async (
  accessToken: NonEmptyString,
  oneIdRepo: Pick<CallbackDeps, "oneIdAPIClient">,
  issuer: ValidUrl,
): Promise<E.Either<Error, Document>> =>
  pipe(
    oneIdRepo.oneIdAPIClient.getSamlAssertion(issuer.href, accessToken),
    TE.chain((response) => {
      return TE.right(safeXMLParseFromString(response));
    }),
    TE.chain(
      TE.fromOption(() => new Error("Empty assertion returned from parsing")),
    ),
  )();

export const OIDCCallback =
  (deps: CallbackDeps) =>
  async (input: CallbackSuccessInput): Promise<CallbackOutput> => {
    const ausiliarDataResult = await getLoginAusiliarData(deps)(input.state);
    if (E.isLeft(ausiliarDataResult)) {
      // the state is either unknown/forged or has already been consumed,
      // hence not retriable
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.ausiliar-data.error",
        properties: {
          errorMessage: ausiliarDataResult.left.message,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });
      return ResponseErrorValidation(
        "Bad request",
        "Missing or expired login state",
      );
    }
    const ausiliarData = ausiliarDataResult.right;

    const envConfigurationResult = await resolveOidcEnvConfiguration(
      ausiliarData.oidcConfigurationEnv,
    );
    if (E.isLeft(envConfigurationResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.discovery.error",
        properties: {
          env: ausiliarData.oidcConfigurationEnv,
          errorMessage: envConfigurationResult.left.message,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });
      return ResponseErrorInternal("OIDC discovery failed");
    }
    const { envConfig, oidcConfiguration } = envConfigurationResult.right;

    const exchangeResult = await exchangeCode(
      oidcConfiguration,
      envConfig,
      ausiliarData,
      input,
    );
    if (E.isLeft(exchangeResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.code-exchange.error",
        properties: {
          env: ausiliarData.oidcConfigurationEnv,
          errorMessage: exchangeResult.left.message,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });
      return ResponseErrorInternal("OIDC code exchange failed");
    }

    const { access_token } = exchangeResult.right;
    const getSAMLAssertionResult = await getSAMLAssertion(
      access_token,
      deps,
      envConfig.issuer,
    );
    if (E.isLeft(getSAMLAssertionResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.saml-assertion.error",
        properties: {
          env: ausiliarData.oidcConfigurationEnv,
          errorMessage: getSAMLAssertionResult.left.message,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });
      return ResponseErrorInternal("OIDC code exchange failed");
    }

    // TODO: perform SAML check against SAML Assertion (view DR), perform MIN_AGE_FF check and
    // call acs with correct parameters
    return ResponsePermanentRedirect(
      getClientProfileRedirectionUrl("work_in_progress"),
    );
  };
