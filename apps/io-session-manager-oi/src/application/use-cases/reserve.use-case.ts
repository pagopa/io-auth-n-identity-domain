import { randomBytes } from "node:crypto";

import {
  ConflictError,
  GenericError,
  NonEmptyString,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  JwkPublicKeyBase64UrlString,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";

import { AusiliarDataPort } from "../../domain/ports/outbound/ausiliar-data.port.js";
import { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import { OidcConfigPort } from "../../domain/ports/outbound/oidc-config.port.js";
import { OidcClientPort } from "../../domain/ports/outbound/oidc.port.js";
import {
  CurrentUser,
  LoginAusiliarData,
  SpidAuthLevel,
} from "../../domain/value-objects/login.vo.js";
import { OidcConfigurationEnv } from "../../domain/value-objects/oidc.vo.js";
import { LoginType } from "@pagopa/io-auth-n-identity-session";

type ReserveDeps = {
  ausiliarDataPort: AusiliarDataPort;
  lollipopPort: LollipopPort;
  oidcClientPort: OidcClientPort;
  oidcConfigPort: OidcConfigPort;
};

type input = {
  oidcConfigurationEnv: OidcConfigurationEnv;
  minAuthLevel: SpidAuthLevel;
  lollipopPublicKey: JwkPublicKeyBase64UrlString;
  lollipopHashAlgorithm: LollipopJwkHashingAlgorithm;
  loginType: LoginType;
  currentUser: CurrentUser;
};

type output = {
  client_id: NonEmptyString;
  state: NonEmptyString;
  nonce: NonEmptyString;
  redirect_uri: NonEmptyString;
  authorization_endpoint: NonEmptyString;
};

export const makeReserveUseCase =
  (
    deps: ReserveDeps,
  ): UseCase<input, output, GenericError | ConflictError | ValidationError> =>
  async (inputData) => {
    const oidcConfigResult = deps.oidcConfigPort.getConfig(
      inputData.oidcConfigurationEnv,
    );
    if (oidcConfigResult.isErr()) {
      return err(oidcConfigResult.error);
    }

    const { clientId, redirectUri: clientRedirectUri } = oidcConfigResult.value;

    const authorizationEndpointResult =
      await deps.oidcClientPort.getAuthorizationEndpoint(
        inputData.oidcConfigurationEnv,
      );
    if (authorizationEndpointResult.isErr()) {
      return err(authorizationEndpointResult.error);
    }

    const reserveResult = await deps.lollipopPort.reservePubKey({
      algo: inputData.lollipopHashAlgorithm,
      pub_key: inputData.lollipopPublicKey,
    });
    if (reserveResult.isErr()) {
      switch (reserveResult.error.kind) {
        case "GenericError":
          return err(new GenericError("cannot reserve pubkey"));
        case "ConflictError":
          return err(new ConflictError("Pubkey is already reserved"));
      }
    }

    const state = randomBytes(24).toString("hex") as NonEmptyString;
    const nonce = randomBytes(24).toString("hex") as NonEmptyString;

    const ausiliarData: LoginAusiliarData = {
      minAuthLevel: inputData.minAuthLevel,
      loginType: inputData.loginType,
      currentUser: inputData.currentUser,
      lollipopAssertionRef: reserveResult.value,
      clientId,
      oidcConfigurationEnv: inputData.oidcConfigurationEnv,
      nonce,
    };

    const ausiliarDataSaveResult = await deps.ausiliarDataPort.save(
      state,
      ausiliarData,
    );

    if (ausiliarDataSaveResult.isErr()) {
      return err(
        new GenericError(
          `Could not save ausiliar data, caused by: ${ausiliarDataSaveResult.error.message}`,
        ),
      );
    }

    return ok({
      client_id: clientId,
      state,
      nonce,
      redirect_uri: clientRedirectUri.href as NonEmptyString,
      authorization_endpoint: authorizationEndpointResult.value
        .href as NonEmptyString,
    });
  };
