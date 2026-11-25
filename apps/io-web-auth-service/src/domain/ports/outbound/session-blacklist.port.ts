import { GenericError, NonEmptyString } from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";

import { PositiveInteger } from "../../value-objects/positive-integer.vo.js";

/**
 * Outbound port tracking sessions that have been invalidated before their
 * natural expiration.
 */
export interface SessionBlacklistPort {
  /**
   * Marks a session as invalidated.
   *
   * @param id the session identifier
   * @param ttlSeconds how long the entry must be kept, normally the remaining
   * lifetime of the session
   * @returns `GenericError` if the entry cannot be stored.
   */
  readonly blacklist: (
    id: NonEmptyString,
    ttlSeconds: PositiveInteger,
  ) => Promise<Result<void, GenericError>>;

  /**
   * Tells whether a session has been invalidated.
   *
   * @param id the session identifier
   * @returns `true` if the session is blacklisted, `GenericError` on
   * unexpected failures.
   */
  readonly isBlacklisted: (
    id: NonEmptyString,
  ) => Promise<Result<boolean, GenericError>>;
}
