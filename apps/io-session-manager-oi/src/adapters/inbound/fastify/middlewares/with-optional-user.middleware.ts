import type {
  AuthenticationError,
  EmptyHttpMiddlewareContext,
  GenericError,
  HttpRequestMiddleware,
} from "@pagopa/hexagonal-core";
import type {
  BaseSession,
  PlainSessionToken,
  SessionId,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import type { AuthenticationMiddleware } from "../../../../middlewares/authentication/index.js";

export type OptionalUserContext =
  | { authenticated: false }
  | {
      authenticated: true;
      value: {
        session: BaseSession;
        sessionId: SessionId;
        sessionToken: PlainSessionToken;
      };
    };

export type OptionalUserMiddleware = HttpRequestMiddleware<
  EmptyHttpMiddlewareContext,
  OptionalUserContext,
  AuthenticationError | GenericError
>;

export const withOptionalUserMiddleware =
  (
    authenticateSession: AuthenticationMiddleware<"session">,
  ): OptionalUserMiddleware =>
  async ({ payload }) => {
    const headers = payload.headers as
      | Record<string, string | undefined>
      | undefined;

    if (headers?.authorization === undefined) {
      return ok({ authenticated: false });
    }

    const result = await authenticateSession({ payload, context: {} });
    return result.isErr()
      ? err(result.error)
      : ok({ authenticated: true, value: result.value });
  };
