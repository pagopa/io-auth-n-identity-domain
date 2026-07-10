import {
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { Result } from "neverthrow";


import { SessionMetadata } from "../../entities/session-metadata.entity.js";
import type {
  Session,
  SessionWithHashedSSOTokens,
} from "../../entities/session.entity.js";
import { HashedBpdSSOTokenWithSessionTrackingId } from "../../value-objects/tokens/bpd-sso-token.vo.js";
import type { HashedSessionTokenWithTrackingId } from "../../value-objects/tokens/session-token.vo.js";

/**
 * Outbound port for managing UserSessions
 */
export interface SessionPort {
  /**
   * Finds a session by its session token.
   * @param sessionToken The hashed session token with tracking ID.
   * @returns The session associated with the given token, or an error if not found or a generic error happens.
   */
  readonly findBySessionToken: (
    sessionToken: HashedSessionTokenWithTrackingId,
  ) => Promise<Result<Session, NotFoundError | GenericError>>;

  /**
   * Finds a session by its BPD SSO token.
   * @param bpdToken The hashed BPD SSO token with session tracking ID.
   * @returns The session associated with the given token, or an error if not found or a generic error happens.
   */
  readonly findByBpdToken: (
    bpdToken: HashedBpdSSOTokenWithSessionTrackingId,
  ) => Promise<Result<Session, NotFoundError | GenericError>>;

  /**
   * Creates a new session with the given metadata and tokens.
   * @param sessionMetadata The metadata for the new session.
   * @param sessionTokens The tokens associated with the new session.
   * @returns The created session, or an error if a conflict occurs or a generic error happens.
   */
  readonly create: (
    sessionMetadata: SessionMetadata,
    sessionTokens: SessionWithHashedSSOTokens,
  ) => Promise<
    Result<SessionWithHashedSSOTokens, ConflictError | GenericError>
  >;

  /**
   * Refreshes an existing session with new tokens.
   * @param sessionTokens The current session tokens.
   * @returns The refreshed session with new tokens, or an error if the session is not found or a generic error happens.
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
    Result<HashedSessionTokenWithTrackingId | undefined, GenericError>
  >;
}
