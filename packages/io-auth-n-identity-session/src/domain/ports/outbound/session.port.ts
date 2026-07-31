import {
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { Result } from "neverthrow";

import { ActiveSession } from "../../entities/active-session.entity.js";
import type {
  SessionWithHashedSSOTokens,
  BaseSession,
} from "../../entities/session.entity.js";
import { SessionId } from "../../value-objects/session-id.vo.js";
import { HashedBpdSSOToken } from "../../value-objects/tokens/bpd-sso-token.vo.js";
import { HashedSessionToken } from "../../value-objects/tokens/session-token.vo.js";

export type HashedSessionTokenWithSessionId = {
  sessionId: SessionId;
  hashedSessionToken: HashedSessionToken;
};

/**
 * Outbound port for managing UserSessions
 */
export interface SessionPort {
  /**
   * Finds a session by its session token.
   * @param hashedSessionToken The hashed session token
   * @param sessionId The session tracking ID
   * @returns The session associated with the given token, or an error if not found or a generic error happens.
   */
  readonly findBySessionToken: ({
    hashedSessionToken,
    sessionId,
  }: HashedSessionTokenWithSessionId) => Promise<
    Result<BaseSession, NotFoundError | GenericError>
  >;

  /**
   * Finds a session by its BPD SSO token.
   * @param hashedBPDSSOToken The hashed BPD SSO token
   * @param sessionId The session tracking ID
   * @returns The session associated with the given token, or an error if not found or a generic error happens.
   */
  readonly findByBpdToken: (bpdToken: {
    hashedBPDSSOToken: HashedBpdSSOToken;
    sessionId: SessionId;
  }) => Promise<Result<BaseSession, NotFoundError | GenericError>>;

  /**
   * Creates a new session with the given session and tokens.
   * @param activeSession The data for the new session.
   * @param sessionTokens The tokens associated with the new session.
   * @returns The created session, or an error if a conflict occurs or a generic error happens.
   */
  readonly create: (
    activeSession: ActiveSession,
    sessionTokens: SessionWithHashedSSOTokens,
  ) => Promise<
    Result<SessionWithHashedSSOTokens, ConflictError | GenericError>
  >;

  /**
   * Refreshes an existing session with new tokens.
   * @param sessionTokens The current session tokens.
   * @returns The refreshed session with new tokens, or an error if a session is already found or a generic error happens.
   */
  readonly refresh: (
    sessionTokens: SessionWithHashedSSOTokens,
  ) => Promise<
    Result<SessionWithHashedSSOTokens, ConflictError | GenericError>
  >;

  /**
   * Deletes an existing session.
   * @param sessionTokens The current session tokens.
   * @returns An error if the session is not found or a generic error happens.
   */
  readonly delete: (
    sessionTokens: SessionWithHashedSSOTokens,
  ) => Promise<Result<void, NotFoundError | GenericError>>;

  /**
   * Invalidates the previous session associated with the given fiscal code.
   * @param fiscalCode The fiscal code of the user.
   * @returns The hashed session token with tracking ID of the invalidated session, or an error if a generic error happens.
   */
  readonly invalidatePreviousSession: (
    fiscalCode: FiscalCode,
  ) => Promise<
    Result<HashedSessionTokenWithSessionId | undefined, GenericError>
  >;
}
