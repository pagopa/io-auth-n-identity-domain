import {
  AuthenticationError,
  ConflictError,
  type FiscalCode,
  GenericError,
  type NonEmptyString,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type {
  IPString,
  JwkPublicKey,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import type { LoginType } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import type { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import type { TestUserPort } from "../../domain/ports/outbound/test-user.port.js";
import type { ClientSessionToken } from "../../domain/value-objects/client-session-token.vo.js";
import {
  getMockedSamlAssertion,
  TEST_LOGIN_USER_DATA,
} from "../../utils/test-login/index.js";

import type { ActivateUserSessionUseCase } from "./activate-user-session.use-case.js";

export type TestLoginDeps = {
  testUserPort: TestUserPort;
  lollipopPort: LollipopPort;
  activateUserSessionUseCase: ActivateUserSessionUseCase;
};

export type TestLoginInput = {
  username: FiscalCode;
  password: NonEmptyString;
  lollipopPublicKey: JwkPublicKey;
  lollipopHashAlgorithm: LollipopJwkHashingAlgorithm;
  loginType: LoginType;
  ipAddress: IPString;
};

export type TestLoginOutput = {
  accessToken: ClientSessionToken;
};

export type TestLoginError = AuthenticationError | ConflictError | GenericError;

export type TestLoginUseCase = UseCase<
  TestLoginInput,
  TestLoginOutput,
  TestLoginError
>;

export const makeTestLoginUseCase =
  (deps: TestLoginDeps): TestLoginUseCase =>
  async (input) => {
    if (!deps.testUserPort.isTestCredentials(input.username, input.password)) {
      return err(new AuthenticationError());
    }

    // Reserve the lollipop public key.
    // We avoid reusing the Reserve Use Case since we don't need the Authorization
    // endpoint and what it entails.
    const reserveResult = await deps.lollipopPort.reservePubKey({
      algo: input.lollipopHashAlgorithm,
      pub_key: input.lollipopPublicKey,
    });
    if (reserveResult.isErr()) {
      switch (reserveResult.error.kind) {
        case "GenericError":
          return err(new GenericError("cannot reserve pubkey"));
        case "ConflictError":
          return err(new ConflictError("Pubkey is already reserved"));
        default: {
          const _exhaustiveCheck: never = reserveResult.error;
          return err(
            new GenericError("Unexpected error while reserving pubkey"),
          );
        }
      }
    }
    const assertionRef = reserveResult.value;

    // The mocked assertion is bound to the reserved key through InResponseTo,
    // as a real SPID assertion would be.
    const rawAssertion = getMockedSamlAssertion({
      fiscalCode: input.username,
      inResponseTo: assertionRef,
    });

    const activateResult = await deps.activateUserSessionUseCase({
      sessionToken: {
        fiscalCode: input.username,
        name: TEST_LOGIN_USER_DATA.name,
        familyName: TEST_LOGIN_USER_DATA.familyName,
        dateOfBirth: new Date(TEST_LOGIN_USER_DATA.dateOfBirth),
        spidLevel: TEST_LOGIN_USER_DATA.spidLevel,
        ipAddress: input.ipAddress,
        loginType: input.loginType,
        identityProvider: TEST_LOGIN_USER_DATA.identityProvider,
      },
      assertion: {
        assertionRef,
        rawAssertion,
        type: "SAML",
      },
    });
    if (activateResult.isErr()) {
      return err(activateResult.error);
    }

    return ok({ accessToken: activateResult.value });
  };
