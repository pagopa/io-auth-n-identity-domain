import {
  AuthenticationError,
  GenericError,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";

import {
  ActiveSession,
  VerifiedActiveSession,
} from "../../entitites/active-session.entity.js";

/**
 * Outbound port managing user sessions. A session is represented by an opaque
 * token handed to the client and presented back on subsequent requests.
 */
export interface SessionPort {
  /**
   * Creates a new session for the given user data.
   *
   * @param data the active session data bound to the new session
   * @returns the opaque session token identifying the new session, or a
   * `GenericError` if the session cannot be created.
   */
  readonly create: (
    data: ActiveSession,
  ) => Promise<Result<NonEmptyString, GenericError>>;

  /**
   * Checks that a session token identifies a valid, non-expired session.
   *
   * @param sessionToken the session token to check
   * @returns the identity and the user data of the verified session,
   * `AuthenticationError` if the session is not valid, `GenericError` on
   * unexpected failures.
   */
  readonly check: (
    sessionToken: NonEmptyString,
  ) => Promise<
    Result<VerifiedActiveSession, AuthenticationError | GenericError>
  >;
}
