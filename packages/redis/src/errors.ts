import {
  AuthenticationError,
  ForbiddenError,
  GatewayTimeoutError,
  GenericError,
  ServiceUnavailableError,
} from "@pagopa/hexagonal-core";

/**
 * Union of `@pagopa/hexagonal-core` domain errors a Redis operation may
 * surface.
 *
 * Anything unmapped is folded into `GenericError`
 */
export type RedisError =
  | AuthenticationError
  | ForbiddenError
  | GatewayTimeoutError
  | GenericError
  | ServiceUnavailableError;

/**
 * Names of `node-redis` error classes we duck-type against.
 */
const CONNECTION_ERROR_NAMES: ReadonlySet<string> = new Set([
  "ClientClosedError",
  "ClientOfflineError",
  "DisconnectsClientError",
  "SocketClosedUnexpectedlyError",
]);

const TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set([
  "ConnectionTimeoutError",
  "TimeoutError",
]);

/**
 * Redis server `-ERR` reply prefixes that indicate a transient
 * cluster/loading state and should be surfaced as
 * {@link ServiceUnavailableError} so callers can retry.
 */
const TRANSIENT_REPLY_PREFIXES = [
  "BUSY",
  "CLUSTERDOWN",
  "LOADING",
  "MASTERDOWN",
  "TRYAGAIN",
] as const;

/**
 * Redis server `-ERR` reply prefixes that indicate an authentication
 * failure (missing/invalid password).
 */
const AUTH_REPLY_PREFIXES = ["NOAUTH", "WRONGPASS"] as const;

/**
 * Redis server `-ERR` reply prefix for ACL permission denials.
 */
const FORBIDDEN_REPLY_PREFIX = "NOPERM";

const startsWithAny = (
  message: string,
  prefixes: ReadonlyArray<string>,
): boolean => prefixes.some((prefix) => message.startsWith(prefix));

/**
 * Maps an unknown error thrown by the `redis` client into the
 * appropriate {@link RedisError} variant.
 *
 * Classification rules:
 * - Connection-lifecycle errors (`ClientClosedError`, `ClientOfflineError`,
 *   `SocketClosedUnexpectedlyError`, `DisconnectsClientError`) →
 *   `ServiceUnavailableError`.
 * - Timeout errors (`ConnectionTimeoutError`, `TimeoutError`) →
 *   `GatewayTimeoutError`.
 * - Server `-ERR` replies (surfaced as `ErrorReply`/`SimpleError`):
 *   - `NOAUTH`, `WRONGPASS` → `AuthenticationError`.
 *   - `NOPERM` → `ForbiddenError`.
 *   - `BUSY`, `LOADING`, `CLUSTERDOWN`, `MASTERDOWN`, `TRYAGAIN` →
 *     `ServiceUnavailableError` (transient, retryable).
 *   - Everything else (`WRONGTYPE`, unknown) → `GenericError`.
 * - Any other throwable → `GenericError`, with the message (and cause,
 *   if any) preserved for diagnostics.
 *
 * @param operation Human-readable label for the failing operation
 *   (e.g. `"SADD BLOCKEDUSERS"`). Included in the error message to aid
 *   log correlation.
 * @param cause The value caught from the `redis` client.
 */
// eslint-disable-next-line complexity
export const toRedisError = (operation: string, cause: unknown): RedisError => {
  if (!(cause instanceof Error)) {
    return new GenericError(`${operation} failed: ${String(cause)}`);
  }

  const { name, message } = cause;
  const detail = `${operation} failed (${name}): ${message}`;

  if (CONNECTION_ERROR_NAMES.has(name)) {
    return new ServiceUnavailableError(detail);
  }

  if (TIMEOUT_ERROR_NAMES.has(name)) {
    return new GatewayTimeoutError(detail);
  }

  const looksLikeReply =
    name === "ErrorReply" ||
    name === "SimpleError" ||
    startsWithAny(message, AUTH_REPLY_PREFIXES) ||
    message.startsWith(FORBIDDEN_REPLY_PREFIX) ||
    startsWithAny(message, TRANSIENT_REPLY_PREFIXES);

  if (looksLikeReply) {
    if (startsWithAny(message, AUTH_REPLY_PREFIXES)) {
      return new AuthenticationError();
    }
    if (message.startsWith(FORBIDDEN_REPLY_PREFIX)) {
      return new ForbiddenError();
    }
    if (startsWithAny(message, TRANSIENT_REPLY_PREFIXES)) {
      return new ServiceUnavailableError(detail);
    }
    return new GenericError(detail);
  }

  const causeMsg =
    cause.cause instanceof Error
      ? cause.cause.message
      : cause.cause !== undefined && typeof cause.cause === "object"
        ? JSON.stringify(cause.cause)
        : cause.cause !== undefined
          ? // eslint-disable-next-line @typescript-eslint/no-base-to-string
            String(cause.cause)
          : "";
  const suffix = causeMsg ? ` Caused by: ${causeMsg}` : "";
  return new GenericError(`${detail}${suffix}`);
};
