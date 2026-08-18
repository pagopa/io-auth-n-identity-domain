import { ok, err, Result } from "neverthrow";
import {
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";

import { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import {
  ActiveSession,
  BaseSession,
  newActiveSession,
  newPlainSession,
  toHashedSession,
} from "@pagopa/io-auth-n-identity-session/entities";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import {
  LoginType,
  newSessionId,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import { UserProfile } from "../../domain/entities/profile.entity.js";
import {
  ClientSessionToken,
  ClientSessionTokenSchema,
  HashedClientSessionTokenSchema,
} from "../../domain/value-objects/client-session-token.vo.js";
import { PlatformInternalPort } from "../../domain/ports/outbound/platform-internal.port.js";

export type NewSessionToken = Omit<
  BaseSession,
  "sessionId" | "expirationDate"
> & {
  ipAddress: IPString;
  loginType: LoginType;
  identityProvider: NonEmptyString;
};

export type ActivateUserSessionUseCase = UseCase<
  NewSessionToken,
  ClientSessionToken,
  GenericError
>;

// ---------------------------------------------
// ActivateUserSession use-case implementation
// ---------------------------------------------

export const makeActivateUserSessionUseCase =
  (
    userSessions: SessionPort,
    profiles: ProfilePort,
    platformInternal: PlatformInternalPort,
  ): ActivateUserSessionUseCase =>
  async (input) => {
    // TODO: check if we can move newSessionId() within newActiveSession() to avoid having to pass sessionId as a parameter
    const sessionId = await newSessionId();

    const activeSession: ActiveSession = newActiveSession({
      fiscalCode: input.fiscalCode,
      loginType: input.loginType,
      sessionId,
    });

    const newSessionWithPlainTokens = await newPlainSession({
      ...input,
      sessionId,
    });

    const newSessionWithHashedTokens = toHashedSession(
      newSessionWithPlainTokens,
    );

    // TODO: invalidate installation id

    // TODO: invalidate lollipop key
    const invalidateResult = await userSessions.invalidatePreviousSession(
      input.fiscalCode,
    );

    if (invalidateResult.isErr()) {
      return err(
        new GenericError(
          `Failed to invalidate previous sessions: ${invalidateResult.error.message}`,
        ),
      );
    }

    if (invalidateResult.value !== undefined) {
      const hashedClientSessionTokenResult =
        HashedClientSessionTokenSchema.safeParse(
          `${invalidateResult.value.sessionId}.${invalidateResult.value.hashedSessionToken}`,
        );

      // This should never happen, but we check it just in case, to avoid sending an invalid token to the platform-internal service.
      if (!hashedClientSessionTokenResult.success) {
        return err(
          new GenericError(
            `Failed to parse hashed client session token: ${hashedClientSessionTokenResult.error.message}`,
          ),
        );
      }

      const proxyResult = await platformInternal.deleteSession(
        hashedClientSessionTokenResult.data,
      );

      if (proxyResult.isErr()) {
        return err(
          new GenericError(
            `Failed to invalidate previous session on proxy: ${proxyResult.error.message}`,
          ),
        );
      }
    }

    // Retrieve user profile, if exists, or create a new one with the provided data.
    // This is needed to ensure that the user profile exists before creating a new session.
    const getOrCreateProfileResult = await getOrCreateProfile(profiles, input);

    if (getOrCreateProfileResult.isErr()) {
      return err(getOrCreateProfileResult.error);
    }

    const userProfile = getOrCreateProfileResult.value;

    const result = await userSessions.create(
      activeSession,
      newSessionWithHashedTokens,
    );

    if (result.isErr()) {
      return err(
        new GenericError(
          `Failed to persist user session: ${result.error.message}`,
        ),
      );
    }

    if (userProfile.email) {
      // Notify login event to user
      const notifyLoginResult = await profiles.notifyLogin({
        fiscalCode: userProfile.fiscalCode,
        name: input.name,
        familyName: input.familyName,
        email: userProfile.email,
        identityProvider: input.identityProvider,
        ipAddress: input.ipAddress,
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

    //TODO: Send login event

    return ok(
      ClientSessionTokenSchema.parse(
        `${newSessionWithPlainTokens.sessionId}.${newSessionWithPlainTokens.plainSessionToken}`,
      ),
    );
  };

// ----------------
// Private helper functions
// ----------------

const getOrCreateProfile = async (
  profiles: ProfilePort,
  input: NewSessionToken,
): Promise<Result<UserProfile, GenericError>> => {
  const getProfileResult = await profiles.getProfile(input.fiscalCode);

  if (getProfileResult.isOk()) {
    return ok(getProfileResult.value);
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

  const createProfileResult = await profiles.create(newUserProfile);

  if (createProfileResult.isErr()) {
    return err(
      new GenericError(
        `Failed to create user profile: ${createProfileResult.error.message}`,
      ),
    );
  } else {
    return ok(createProfileResult.value);
  }
};
