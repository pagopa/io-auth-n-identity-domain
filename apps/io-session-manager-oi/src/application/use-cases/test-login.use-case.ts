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
import type { OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";
import {
  getMockedSamlAssertion,
  TEST_LOGIN_USER_DATA,
} from "../../utils/test-login/index.js";

import type { ActivateUserSessionUseCase } from "./activate-user-session.use-case.js";
import type { ValidateProfileLocksUseCase } from "./validate-profile-locks.use-case.js";

export type TestLoginDeps = {
  testUserPort: TestUserPort;
  lollipopPort: LollipopPort;
  validateProfileLocksUseCase: ValidateProfileLocksUseCase;
  activateTestUserSessionUseCase: ActivateUserSessionUseCase;
  oidcEnvironment: OidcEnvironment;
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

    // Using the default test user SPID level for the assertion.
    // If needed, this can be extended to accept different SPID levels for the test user
    // in the input parameters of the use case.
    const spidLevel = TEST_LOGIN_USER_DATA.spidLevel;

    // Check profile locks before reserving a key or activating the session.
    const validateProfileLocksResult = await deps.validateProfileLocksUseCase({
      fiscalCode: input.username,
      checks:
        spidLevel === "https://www.spid.gov.it/SpidL3"
          ? ["technical"]
          : ["user-set", "technical"],
    });
    if (validateProfileLocksResult.isErr()) {
      const error = validateProfileLocksResult.error;
      switch (error.kind) {
        case "ForbiddenError": {
          const e = new AuthenticationError();
          e.cause = error;
          return err(e);
        }
        case "GenericError": {
          const e = new GenericError("Error while validating profile locks");
          e.cause = error;
          return err(e);
        }
        default: {
          const _exhaustiveCheck: never = error;
          const e = new GenericError("Unhandled error");
          e.cause = error;
          return err(e);
        }
      }
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
        case "GenericError": {
          const e = new GenericError("Cannot reserve pubkey");
          e.cause = reserveResult.error;
          return err(e);
        }
        case "ConflictError": {
          const e = new ConflictError("Pubkey is already reserved");
          e.cause = reserveResult.error;
          return err(e);
        }
        default: {
          const _exhaustiveCheck: never = reserveResult.error;
          const e = new GenericError("Unexpected error while reserving pubkey");
          e.cause = reserveResult.error;
          return err(e);
        }
      }
    }
    const assertionRef = reserveResult.value;

    // The mocked assertion is bound to the reserved key through InResponseTo,
    // as a real SPID assertion would be.
    const rawAssertion = getMockedSamlAssertion({
      fiscalCode: input.username,
      inResponseTo: assertionRef,
      spidLevel,
    });

    const activateResult = await deps.activateTestUserSessionUseCase({
      sessionToken: {
        fiscalCode: input.username,
        name: TEST_LOGIN_USER_DATA.name,
        familyName: TEST_LOGIN_USER_DATA.familyName,
        dateOfBirth: new Date(TEST_LOGIN_USER_DATA.dateOfBirth),
        spidLevel: TEST_LOGIN_USER_DATA.spidLevel,
        ipAddress: input.ipAddress,
        loginType: input.loginType,
        idp: TEST_LOGIN_USER_DATA.identityProvider,
      },
      assertion: {
        assertionRef,
        rawAssertion,
        type: "SAML",
      },
      oidcEnvironment: deps.oidcEnvironment,
    });
    if (activateResult.isErr()) {
      return err(activateResult.error);
    }

    return ok({ accessToken: activateResult.value });
  };
