import type * as client from "openid-client" with { "resolution-mode": "import" };
import type * as express from "express";
import * as E from "fp-ts/Either";
import * as AP from "fp-ts/lib/Apply";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { calculateJwkThumbprint } from "jose";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import {
  getOneIdEnvConfig,
  LOGIN_AUXILIARY_DATA_TTL_SECONDS,
  OidcEnvConfig,
  ONEID_HTTP_TIMEOUT_SECONDS,
} from "../config/one-id";
import { AssertionRef } from "../generated/lollipop-api/AssertionRef";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { OneIdRepo, RedisRepo } from "../repositories";
import {
  exchangeAuthorizationCode,
  getOidcConfiguration,
} from "../repositories/oidc-client";
import {
  CallbackSuccessInput,
  ExchangeCodeAPIResponse,
  ExchangeCodeResult,
  LoginAuxiliaryData,
  OidcUserClaims,
  ReserveInput,
} from "../types/oidc";
import { getAndDelete, save } from "./redis-auxiliary-data";
import { getNewTokenAsync } from "./token";
import { UrlFromString, ValidUrl } from "@pagopa/ts-commons/lib/url";
import { AppInsightsDeps } from "../utils/appinsights";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { ReserveResponse } from "../generated/backend/ReserveResponse";
import { AssertionConsumerServiceT } from "@pagopa/io-spid-commons";
import * as AuthenticationController from "../controllers/authentication";
import { AcsDependencies } from "../controllers/authentication";
import { AdditionalLoginPropsT } from "../types/fast-login";
import { SpidUser } from "../types/user";
import { WithExpressRequest } from "../utils/express";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import {
  getFiscalNumberFromPayload,
  getRequestIDFromResponse,
  isSpidLevelGreaterOrEqual,
  isWellFormedSAMLAssertion,
} from "../utils/spid";
import { getIdpFriendlyName } from "../repositories/idp-friendly-names";

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
    // auxiliary data.
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

    const auxiliaryData: LoginAuxiliaryData = {
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
      auxiliaryData,
      LOGIN_AUXILIARY_DATA_TTL_SECONDS,
    )(deps)();
    if (E.isLeft(saveResult)) {
      // reserve operation is retriable, therefore this event can follow
      // sampling strategy
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.reserve.auxiliary-data.error",
        properties: {
          env: input.env,
          errorMessage: saveResult.left.message,
        },
      });
      return ResponseErrorInternal(`Could not save auxiliary data`);
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

export const getLoginAuxiliaryData =
  (deps: RedisRepo.RedisRepositoryDeps) =>
  (state: NonEmptyString): Promise<E.Either<Error, LoginAuxiliaryData>> =>
    pipe(
      getAndDelete(state)(deps),
      TE.chainEitherKW(
        E.fromOption(
          () => new Error("Missing or expired OIDC login auxiliary data"),
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
  auxiliaryData: LoginAuxiliaryData,
  input: CallbackSuccessInput,
): Promise<E.Either<Error, ExchangeCodeResult>> => {
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
        expectedNonce: auxiliaryData.nonce,
        expectedState: input.state,
        idTokenExpected: true,
      },
    );
    return pipe(
      E.Do,
      E.bind("tokens", () =>
        pipe(
          tokenResponse,
          ExchangeCodeAPIResponse.decode,
          E.mapLeft(
            (err) =>
              new Error(
                `Could not decode OIDC exchange code API response: ${readableReportSimplified(err)}`,
              ),
          ),
        ),
      ),
      E.bind("claims", () =>
        pipe(
          tokenResponse.claims(),
          OidcUserClaims.decode,
          E.mapLeft(
            (err) =>
              new Error(
                `Could not decode OIDC id_token claims: ${readableReportSimplified(err)}`,
              ),
          ),
        ),
      ),
      E.map(({ tokens, claims }) => ({
        accessToken: tokens.access_token,
        claims,
      })),
    );
  } catch (err) {
    return E.left(err instanceof Error ? err : new Error(String(err)));
  }
};

export type SAMLAssertion = {
  assertionXml: NonEmptyString;
  assertion: Document;
};

export const getSAMLAssertion = async (
  accessToken: NonEmptyString,
  oneIdRepo: Pick<CallbackDeps, "oneIdAPIClient">,
  issuer: ValidUrl,
): Promise<E.Either<Error, SAMLAssertion>> =>
  pipe(
    oneIdRepo.oneIdAPIClient.getSamlAssertion(issuer.href, accessToken),
    TE.chainEitherKW((rawAssertion) =>
      pipe(
        NonEmptyString.decode(rawAssertion),
        E.mapLeft(() => new Error("Empty assertion returned")),
        E.chain((assertionXml) =>
          pipe(
            safeXMLParseFromString(assertionXml),
            E.fromOption(
              () => new Error("Empty assertion returned from parsing"),
            ),
            E.map((assertion) => ({ assertionXml, assertion })),
          ),
        ),
      ),
    ),
  )();

/**
 * Performs the required verifications on the SAML assertion retrieved from
 * OneIdentity, cross-checking it against the id token claims (already
 * decoded in `exchangeCode`) and the auxiliary data saved at `reserve` time:
 *
 * 1. the assertion is well formed and has not been tampered with
 * 2. `fiscalNumber` in the id token claims matches the one in the assertion
 * 3. the assertion `InResponseTo` matches the lollipop assertion ref sent
 *    with the original authorization request
 * 4. the SPID level granted by the assertion (via the id token `acr` claim)
 *    is equal or greater than the requested `minAuthLevel`
 */
export const performSAMLAssertionChecks = (
  samlAssertion: Document,
  idTokenClaims: OidcUserClaims,
  auxiliaryData: LoginAuxiliaryData,
): TE.TaskEither<Error, true> =>
  pipe(
    AP.sequenceT(TE.ApplicativePar)(
      TE.fromPredicate(
        () => isWellFormedSAMLAssertion(samlAssertion),
        () => new Error("SAML assertion has an invalid or tampered format"),
      )(samlAssertion),
      pipe(
        getFiscalNumberFromPayload(samlAssertion),
        E.fromOption(
          () =>
            new Error("Could not extract fiscalNumber from the SAML assertion"),
        ),
        E.chain((samlFiscalNumber) =>
          samlFiscalNumber === idTokenClaims.fiscalNumber
            ? E.right(true as const)
            : E.left(
                new Error(
                  "Fiscal number mismatch between id token and SAML assertion",
                ),
              ),
        ),
        TE.fromEither,
      ),
      pipe(
        getRequestIDFromResponse(samlAssertion),
        E.fromOption(
          () =>
            new Error("Could not extract InResponseTo from the SAML assertion"),
        ),
        E.chain((inResponseTo) =>
          inResponseTo === auxiliaryData.lollipopAssertionRef
            ? E.right(true as const)
            : E.left(
                new Error(
                  "SAML assertion InResponseTo does not match the expected assertion ref",
                ),
              ),
        ),
        TE.fromEither,
      ),
      pipe(
        isSpidLevelGreaterOrEqual(idTokenClaims.acr, auxiliaryData.minAuthLevel)
          ? E.right(true as const)
          : E.left(
              new Error(
                "SPID authentication level lower than the requested minAuthLevel",
              ),
            ),
        TE.fromEither,
      ),
    ),
    TE.map((_) => true as const),
  );

/**
 * Builds the SPID-user shaped payload consumed by `acs` from the OneIdentity
 * id_token claims. `dateOfBirth` is re-encoded as a string because acs
 * consumes it as such.
 */
export const buildSpidUserPayload = (
  claims: OidcUserClaims,
  { assertionXml }: SAMLAssertion,
  req: express.Request,
): SpidUser => ({
  authnContextClassRef: claims.acr,
  dateOfBirth: DateFromString.encode(claims.dateOfBirth),
  email: claims.email,
  familyName: claims.familyName,
  fiscalNumber: claims.fiscalNumber,
  getAcsOriginalRequest: () => req,
  getAssertionXml: () => assertionXml,
  getSamlResponseXml: () => assertionXml,
  // `issuer` is the SPID identity provider identifier
  issuer: claims.idpEntityId,
  name: claims.name,
});

export const OIDCCallback =
  (deps: CallbackDeps & WithExpressRequest) =>
  async (input: CallbackSuccessInput): Promise<CallbackOutput> => {
    const auxiliaryDataResult = await getLoginAuxiliaryData(deps)(input.state);
    if (E.isLeft(auxiliaryDataResult)) {
      // the state is either unknown/forged or has already been consumed,
      // hence not retriable
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.auxiliary-data.error",
        properties: {
          errorMessage: auxiliaryDataResult.left.message,
        },
      });
      return ResponseErrorValidation(
        "Bad request",
        "Missing or expired login state",
      );
    }
    const auxiliaryData = auxiliaryDataResult.right;

    const envConfigurationResult = await resolveOidcEnvConfiguration(
      auxiliaryData.oidcConfigurationEnv,
    );
    if (E.isLeft(envConfigurationResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.discovery.error",
        properties: {
          env: auxiliaryData.oidcConfigurationEnv,
          errorMessage: envConfigurationResult.left.message,
        },
      });
      return ResponseErrorInternal("OIDC discovery failed");
    }
    const { envConfig, oidcConfiguration } = envConfigurationResult.right;

    const exchangeResult = await exchangeCode(
      oidcConfiguration,
      envConfig,
      auxiliaryData,
      input,
    );
    if (E.isLeft(exchangeResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.code-exchange.error",
        properties: {
          env: auxiliaryData.oidcConfigurationEnv,
          errorMessage: exchangeResult.left.message,
        },
      });
      return ResponseErrorInternal("OIDC code exchange failed");
    }

    const { accessToken: access_token, claims } = exchangeResult.right;
    const getSAMLAssertionResult = await getSAMLAssertion(
      access_token,
      deps,
      envConfig.issuer,
    );
    if (E.isLeft(getSAMLAssertionResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.saml-assertion.error",
        properties: {
          env: auxiliaryData.oidcConfigurationEnv,
          errorMessage: getSAMLAssertionResult.left.message,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });
      return ResponseErrorInternal("SAML assertion retrieval failed");
    }
    const samlAssertion = getSAMLAssertionResult.right;

    const verifySAMLAssertionResult = await performSAMLAssertionChecks(
      samlAssertion.assertion,
      claims,
      auxiliaryData,
    )();
    if (E.isLeft(verifySAMLAssertionResult)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "session-manager.oidc.callback.saml-verification.error",
        properties: {
          env: auxiliaryData.oidcConfigurationEnv,
          errorMessage: verifySAMLAssertionResult.left.message,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });
      return ResponseErrorValidation(
        "Bad request",
        "SAML assertion verification failed",
      );
    }

    const userPayload = buildSpidUserPayload(
      claims,
      getSAMLAssertionResult.right,
      deps.req,
    );

    const additionalProps: AdditionalLoginPropsT = {
      loginType: auxiliaryData.loginType,
      currentUser: auxiliaryData.currentUser,
    };

    // The validation cookie is not part of the OIDC callback flow, so the user
    // is marked as not eligible to make `acs` skip the cookie check.
    return AuthenticationController.acs({
      ...deps,
      isUserElegibleForValidationCookie: () => false,
      // Return an already built SPID-user payload.
      validateSpidUser: (_rawValue: unknown) => E.right(userPayload),
      getIdentityProvider: (issuer) =>
        getIdpFriendlyName(auxiliaryData.oidcConfigurationEnv, issuer),
    })(userPayload, additionalProps);
  };
