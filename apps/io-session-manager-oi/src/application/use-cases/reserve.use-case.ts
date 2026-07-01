import {
  ConflictError,
  GenericError,
  NonEmptyString,
  UseCase,
} from "@pagopa/hexagonal-core";
import { OidcConfigurationEnv } from "../../domain/entities/oidc.js";
import {
  CurrentUser,
  LoginType,
  SpidAuthLevel,
} from "../../domain/entities/login.js";
import {
  JwkPublicKey,
  LollipopAssertionRef,
  LollipopHashAlgorithm,
} from "../../domain/entities/lollipop.js";
import * as nt from "neverthrow";
import { LollipopClientI } from "../../domain/ports/outbound/lollipopClient.js";
import { AusiliarDataI } from "../../domain/ports/outbound/ausiliarData.js";
import { calculateJwkThumbprint } from "jose";
import { randomBytes } from "node:crypto";

type ReserveDeps = {
  ausiliarDataRepository: AusiliarDataI;
  lollipopClientRepository: LollipopClientI;
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
  lollipopPublicKey: JwkPublicKey;
  lollipopHashAlgorithm: LollipopHashAlgorithm;
  loginType: LoginType;
  currentUser: CurrentUser;
};

type output = {
  clientId: NonEmptyString;
  state: NonEmptyString;
  nonce: NonEmptyString;
  redirectUri: NonEmptyString;
  oneIdBaseUrl: NonEmptyString;
};

export const makeReserveUseCase =
  (deps: ReserveDeps): UseCase<input, output, GenericError | ConflictError> =>
  async (inputData) => {
    const reserveResult =
      await deps.lollipopClientRepository.reserveLollipopKey(
        inputData.lollipopHashAlgorithm,
        inputData.lollipopPublicKey,
      );
    if (reserveResult.isErr()) {
      switch (reserveResult.error.kind) {
        case "GenericError":
          return nt.err(new GenericError("cannot reserve pubkey"));
        case "ConflictError":
          return nt.err(new ConflictError("Pubkey is already reserved"));
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
      authLevel: inputData.authLevel,
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
      return nt.err(new GenericError("Could not save ausiliar data"));
    }

    console.log({
      clientId,
      state,
      nonce,
      redirectUri: inputData.oidc.clientRedirectUri.href as NonEmptyString,
      oneIdBaseUrl: oneIdBaseUrl.href as NonEmptyString,
    });
    return nt.ok({
      clientId,
      state,
      nonce,
      redirectUri: inputData.oidc.clientRedirectUri.href as NonEmptyString,
      oneIdBaseUrl: oneIdBaseUrl.href as NonEmptyString,
    });
  };
