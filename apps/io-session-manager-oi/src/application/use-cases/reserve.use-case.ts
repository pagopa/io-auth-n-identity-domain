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
import {
  CurrentUser,
  LoginAusiliarData,
  LoginType,
  SpidAuthLevel,
} from "../../domain/value-objects/login.vo.js";
import { OidcConfigurationEnv } from "../../domain/value-objects/oidc.vo.js";

type ReserveDeps = {
  ausiliarDataPort: AusiliarDataPort;
  lollipopPort: LollipopPort;
  oidcConfigPort: OidcConfigPort;
};

type input = {
  oidcConfigurationEnv: OidcConfigurationEnv;
  authLevel: SpidAuthLevel;
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
  issuer: NonEmptyString;
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

    const {
      clientId,
      baseUrl: oneIdBaseUrl,
      redirectUri: clientRedirectUri,
    } = oidcConfigResult.value;

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
      minAuthLevel: inputData.authLevel,
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
      return err(new GenericError("Could not save ausiliar data"));
    }

    return ok({
      client_id: clientId,
      state,
      nonce,
      redirect_uri: clientRedirectUri.href as NonEmptyString,
      issuer: oneIdBaseUrl.href as NonEmptyString,
    });
  };
