import * as E from "fp-ts/Either";
import { calculateJwkThumbprint } from "jose";
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
  LOGIN_AUSILIAR_DATA_TTL_SECONDS,
  ONEID_HTTP_TIMEOUT_SECONDS,
} from "../config/one-id";
import { AssertionRef } from "../generated/lollipop-api/AssertionRef";
import { RedisRepo } from "../repositories";
import { getOidcConfiguration } from "../repositories/oidc-client";
import {
  LoginAusiliarData,
  ReserveInput,
  ReserveResponse,
} from "../types/oidc";
import { save } from "./redis-ausiliar-data";
import { getNewTokenAsync } from "./token";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";

export type ReserveDeps = RedisRepo.RedisRepositoryDeps;

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
      return ResponseErrorInternal(
        `OIDC discovery failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const errorOrAuthorizationEndpoint = UrlFromString.decode(
      oidcConfiguration.serverMetadata().authorization_endpoint,
    );

    if (E.isLeft(errorOrAuthorizationEndpoint)) {
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
      return ResponseErrorInternal(
        `Could not save ausiliar data: ${saveResult.left.message}`,
      );
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
