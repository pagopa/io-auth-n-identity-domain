import {
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import {
  BaseSession,
  newActiveSession,
  newPlainSessionTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import {
  LollipopActivationPort,
  SessionPort,
} from "@pagopa/io-auth-n-identity-session/ports";
import {
  LoginType,
  newSessionId,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok, Result } from "neverthrow";

import { UserProfile } from "../../domain/entities/profile.entity.js";
import { AuthEventPort } from "../../domain/ports/outbound/auth-event.port.js";
import { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import { PlatformInternalPort } from "../../domain/ports/outbound/platform-internal.port.js";
import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import { IdentityAssertion } from "../../domain/value-objects/assertion.vo.js";
import {
  ClientSessionToken,
  ClientSessionTokenSchema,
  HashedClientSessionTokenSchema,
} from "../../domain/value-objects/client-session-token.vo.js";

export type NewSessionToken = Omit<
  BaseSession,
  "sessionId" | "expirationDate" | "createdAt"
> & {
  ipAddress: IPString;
  loginType: LoginType;
  identityProvider: NonEmptyString;
};

type ActivateUserSessionUseCaseInput = {
  sessionToken: NewSessionToken;
  assertion: Pick<IdentityAssertion, "assertionRef" | "rawAssertion" | "type">;
};

export type ActivateUserSessionUseCase = UseCase<
  ActivateUserSessionUseCaseInput,
  ClientSessionToken,
  GenericError
>;

// ---------------------------------------------
// ActivateUserSession use-case implementation
// ---------------------------------------------

export const makeActivateUserSessionUseCase =
  (deps: {
    sessionPort: SessionPort;
    profilePort: ProfilePort;
    platformInternalPort: PlatformInternalPort;
    authEventPort: AuthEventPort;
    lollipopActivationPort: LollipopActivationPort;
    lollipopPort: LollipopPort;
  }): ActivateUserSessionUseCase =>
  async (input) => {
    const invalidationResult = await invalidatePreviousUserState({
      sessionPort: deps.sessionPort,
      platformInternalPort: deps.platformInternalPort,
    })(input.sessionToken.fiscalCode);

    if (invalidationResult.isErr()) {
      return err(invalidationResult.error);
    }

    /*********************************/
    /* Lollipop (session) activation */
    /*********************************/
    const lollipopUpsertResult = await deps.lollipopActivationPort.upsert({
      fiscalCode: input.sessionToken.fiscalCode,
      assertionRef: input.assertion.assertionRef,
      expirationDate: new Date(),
    });
    if (lollipopUpsertResult.isErr()) {
      return err(
        new GenericError(
          `Failed to invalidate previous lollipop activation: ${lollipopUpsertResult.error.message}`,
        ),
      );
    }

    /****************************************/
    /* Create new active session "instance" */
    /****************************************/
    // TODO: check if we can move newSessionId() within newActiveSession() to avoid having to pass sessionId as a parameter
    const sessionId = await newSessionId();
    const activeSession = newActiveSession({
      fiscalCode: input.sessionToken.fiscalCode,
      loginType: input.sessionToken.loginType,
      sessionId,
    });

    /**********************************/
    /* Lollipop public key activation */
    /**********************************/
    const lollipopPubKeyActivationResult =
      await deps.lollipopPort.activatePubKey(input.assertion.assertionRef, {
        fiscal_code: input.sessionToken.fiscalCode,
        assertion: input.assertion.rawAssertion,
        assertion_type: input.assertion.type,
        expired_at: activeSession.expirationDate,
      });
    if (lollipopPubKeyActivationResult.isErr()) {
      // try to revoke the lollipop activation if the public key activation fails
      const revokeResult = await deps.lollipopActivationPort.revokeByFiscalCode(
        input.sessionToken.fiscalCode,
      );
      if (revokeResult.isErr()) {
        // Log the failure to revoke the lollipop activation
        console.warn(
          `Failed to revoke lollipop activation: ${revokeResult.error.message}`,
        );
      }
      return err(
        new GenericError(
          `Failed to activate lollipop public key: ${lollipopPubKeyActivationResult.error.message}`,
        ),
      );
    }

    /**************************************/
    /* User profile retrieval or creation */
    /**************************************/
    // Retrieve user profile, if exists, or create a new one with the provided data.
    // This is needed to ensure that the user profile exists before creating a new session.
    const getOrCreateProfileResult = await getOrCreateProfile({
      profilePort: deps.profilePort,
    })(input.sessionToken);

    if (getOrCreateProfileResult.isErr()) {
      return err(getOrCreateProfileResult.error);
    }
    const userProfile = getOrCreateProfileResult.value;

    /*************************/
    /* User session creation */
    /*************************/
    const plainSessionTokens = await newPlainSessionTokens({
      ...input.sessionToken,
      sessionId,
    });
    const hashedSessionTokens = toHashedSessionTokens(plainSessionTokens);
    const result = await deps.sessionPort.create(
      activeSession,
      hashedSessionTokens,
    );
    if (result.isErr()) {
      return err(
        new GenericError(
          `Failed to persist user session: ${result.error.message}`,
        ),
      );
    }
    const createdSession = result.value;

    /********************/
    /* Send login event */
    /********************/
    const sendEventResult = await deps.authEventPort.sendEvent({
      eventType: "login",
      fiscalCode: userProfile.fiscalCode,
      ts: activeSession.createdAt,
      expiredAt: activeSession.expirationDate,
      loginType: input.sessionToken.loginType === "LEGACY" ? "legacy" : "lv", // TODO: evaluate if a more structured approach is needed
      scenario: "standard", // TODO: handle also "new_user" and "relogin"
      idp: input.sessionToken.identityProvider,
    });
    if (sendEventResult.isErr()) {
      return err(
        new GenericError(
          `Failed to emit login event: ${sendEventResult.error.message}`,
        ),
      );
    }

    /******************************/
    /* Notify login event to user */
    /******************************/
    if (userProfile.email) {
      // Notify login event to user
      const notifyLoginResult = await deps.profilePort.notifyLogin({
        fiscalCode: userProfile.fiscalCode,
        name: input.sessionToken.name,
        familyName: input.sessionToken.familyName,
        email: userProfile.email,
        identityProvider: input.sessionToken.identityProvider,
        ipAddress: input.sessionToken.ipAddress,
        isEmailValidated: userProfile.isEmailValidated,
      });

      if (notifyLoginResult.isErr()) {
        return err(
          new GenericError(
            `Failed to notify login event: ${notifyLoginResult.error.message}`,
          ),
        );
      }
    }

    return ok(
      ClientSessionTokenSchema.parse(
        `${plainSessionTokens.sessionId}.${plainSessionTokens.plainSessionToken}`,
      ),
    );
  };

// ----------------
// Private helper functions
// ----------------

const invalidatePreviousUserState =
  (deps: {
    sessionPort: SessionPort;
    platformInternalPort: PlatformInternalPort;
  }) =>
  async (
    fiscalCode: NewSessionToken["fiscalCode"],
  ): Promise<Result<void, GenericError>> => {
    // TODO: invalidate installation id

    // TODO: invalidate lollipop key (revoke previous lollipop activation by sending an event)

    const previousSessionInvalidationResult =
      await deps.sessionPort.invalidatePreviousSession(fiscalCode);

    if (previousSessionInvalidationResult.isErr()) {
      return err(
        new GenericError(
          `Failed to invalidate previous sessions: ${previousSessionInvalidationResult.error.message}`,
        ),
      );
    }

    const previousHashedSession = previousSessionInvalidationResult.value;

    if (previousHashedSession === undefined) {
      return ok(undefined);
    }

    const hashedClientSessionTokenParseResult =
      HashedClientSessionTokenSchema.safeParse(
        `${previousHashedSession.sessionId}.${previousHashedSession.hashedSessionToken}`,
      );

    // This should never happen, but we check it just in case, to avoid sending an invalid token to the platform-internal service.
    if (!hashedClientSessionTokenParseResult.success) {
      return err(
        new GenericError(
          `Failed to parse hashed client session token: ${hashedClientSessionTokenParseResult.error.message}`,
        ),
      );
    }

    const cachedSessionInvalidationResult =
      await deps.platformInternalPort.deleteSession(
        hashedClientSessionTokenParseResult.data,
      );

    if (cachedSessionInvalidationResult.isErr()) {
      return err(
        new GenericError(
          `Failed to invalidate previous session on proxy: ${cachedSessionInvalidationResult.error.message}`,
        ),
      );
    }

    return ok(undefined);
  };

const getOrCreateProfile =
  (deps: { profilePort: ProfilePort }) =>
  async (
    input: NewSessionToken,
  ): Promise<Result<UserProfile & { isNew: boolean }, GenericError>> => {
    const getProfileResult = await deps.profilePort.getProfile(
      input.fiscalCode,
    );

    if (getProfileResult.isOk()) {
      return ok({ ...getProfileResult.value, isNew: false });
    }

    if (!(getProfileResult.error instanceof NotFoundError)) {
      return err(
        new GenericError(
          `Failed to retrieve user profile: ${getProfileResult.error.message}`,
        ),
      );
    }

    // NotFoundError: create a new user profile with the provided data
    const newUserProfile: UserProfile = {
      fiscalCode: input.fiscalCode,
      isEmailValidated: false,
      email: input.spidEmail,
    };

    const createProfileResult = await deps.profilePort.create(newUserProfile);

    if (createProfileResult.isErr()) {
      return err(
        new GenericError(
          `Failed to create user profile: ${createProfileResult.error.message}`,
        ),
      );
    } else {
      return ok({ ...createProfileResult.value, isNew: true });
    }
  };
