import {
  type FiscalCode,
  GenericError,
  NotFoundError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type {
  LoginType,
  SessionPort,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import type { AuthLockPort } from "../../domain/ports/auth-lock.port.js";

export type GetSessionStateInput = {
  fiscalCode: FiscalCode;
};

type SessionInfo =
  | {
      active: false;
    }
  | {
      active: true;
      expiration_date: string;
      type: LoginType;
    };

export type GetSessionStateOutput = {
  access_enabled: boolean;
  session_info: SessionInfo;
};

export type GetSessionStateUseCase = UseCase<
  GetSessionStateInput,
  GetSessionStateOutput,
  GenericError
>;

type GetSessionStateDeps = {
  sessionPort: Pick<SessionPort, "findActiveSession">;
  authenticationLockPort: Pick<
    AuthLockPort,
    "isUserAuthenticationLocked"
  >;
};

export const makeGetSessionStateUseCase =
  (deps: GetSessionStateDeps): GetSessionStateUseCase =>
  async ({ fiscalCode }) => {
    const [activeSessionResult, lockResult] = await Promise.all([
      deps.sessionPort.findActiveSession(fiscalCode),
      deps.authenticationLockPort.isUserAuthenticationLocked(fiscalCode),
    ]);

    if (lockResult.isErr()) {
      const error = new GenericError(`Failed to retrieve user access status`);
      error.cause = lockResult.error;
      return err(error);
    }

    if (activeSessionResult.isErr()) {
      if (!(activeSessionResult.error instanceof NotFoundError)) {
        const error = new GenericError(`Failed to retrieve active session`);
        error.cause = activeSessionResult.error;
        return err(error);
      }

      return ok({
        access_enabled: !lockResult.value,
        session_info: { active: false },
      });
    }

    const activeSession = activeSessionResult.value;
    if (activeSession.expirationDate.getTime() <= Date.now()) {
      return ok({
        access_enabled: !lockResult.value,
        session_info: { active: false },
      });
    }

    return ok({
      access_enabled: !lockResult.value,
      session_info: {
        active: true,
        expiration_date: activeSession.expirationDate.toISOString(),
        type: activeSession.loginType,
      },
    });
  };
