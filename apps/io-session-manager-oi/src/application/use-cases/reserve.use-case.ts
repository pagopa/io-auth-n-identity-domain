import {
  ConflictError,
  GenericError,
  NonEmptyString,
  UseCase,
} from "@pagopa/hexagonal-core";
import { OidcConfigurationEnv } from "../../domain/value-objects/oidc.vo.js";
import {
  CurrentUser,
  LoginType,
  SpidAuthLevel,
} from "../../domain/value-objects/login.vo.js";
import { err, ok } from "neverthrow";
import { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import { AusiliarDataPort } from "../../domain/ports/outbound/ausiliar-data.port.js";
import { calculateJwkThumbprint } from "jose";
import { randomBytes } from "node:crypto";
import {
  JwkPublicKeyBase64UrlString,
  LollipopAssertionRef,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";

type ReserveDeps = {
  ausiliarDataRepository: AusiliarDataPort;
  lollipopClientRepository: LollipopPort;
};

type input = {
  oidc: {
    configurationEnv: OidcConfigurationEnv;
    prodClientId: NonEmptyString;
    prodBaseUrl: URL;
    uatClientId?: NonEmptyString;
    uatBaseUrl?: URL;
    clientRedirectUri: URL;
  };
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
  (deps: ReserveDeps): UseCase<input, output, GenericError | ConflictError> =>
  async (inputData) => {
    const reserveResult = await deps.lollipopClientRepository.reservePubKey({
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
    const lollipopPubKeyThumbprint = await calculateJwkThumbprint(
      inputData.lollipopPublicKey,
      inputData.lollipopHashAlgorithm,
    );

    const lollipopAssertionRef =
      `${inputData.lollipopHashAlgorithm}-${lollipopPubKeyThumbprint}` as LollipopAssertionRef;

    const clientId =
      inputData.oidc.configurationEnv == "PROD"
        ? inputData.oidc.prodClientId
        : // TODO: refactor undefined behaviour
          inputData.oidc.uatClientId || ("UNKNOWN" as NonEmptyString);
    const oneIdBaseUrl =
      inputData.oidc.configurationEnv == "PROD"
        ? inputData.oidc.prodBaseUrl
        : // TODO: refactor undefined behaviour
          inputData.oidc.uatBaseUrl || new URL("http://localhost");

    const ausiliarData = {
      minAuthLevel: inputData.authLevel,
      loginType: inputData.loginType,
      currentUser: inputData.currentUser,
      lollipopAssertionRef,
      clientId,
    };
    const ausiliarDataKey = `RESERVE-${state}`;

    const ausiliarDataSaveResult = await deps.ausiliarDataRepository.save(
      ausiliarDataKey,
      ausiliarData,
    );

    if (ausiliarDataSaveResult.isErr()) {
      return err(new GenericError("Could not save ausiliar data"));
    }

    console.log({
      clientId,
      state,
      nonce,
      redirectUri: inputData.oidc.clientRedirectUri.href as NonEmptyString,
      oneIdBaseUrl: oneIdBaseUrl.href as NonEmptyString,
    });
    return ok({
      client_id: clientId,
      state,
      nonce,
      redirect_uri: inputData.oidc.clientRedirectUri.href as NonEmptyString,
      issuer: oneIdBaseUrl.href as NonEmptyString,
    });
  };
