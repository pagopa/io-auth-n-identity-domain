import {
  AuthenticationError,
  EmptyHttpMiddlewareContext,
  GenericError,
  HttpRequestMiddleware,
} from "@pagopa/hexagonal-core";
import {
  BaseSession,
  PlainSessionToken,
  PlainSessionTokenSchema,
  SessionId,
  SessionPort,
  toHashedSessionToken,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { createBearerTokenSchema } from "../adapters/inbound/bearer-token.js";

const BearerSessionTokenSchema = createBearerTokenSchema(
  PlainSessionTokenSchema,
);

export const authenticate: (deps: {
  sessionPort: SessionPort;
}) => HttpRequestMiddleware<
  EmptyHttpMiddlewareContext,
  {
    session: BaseSession;
    sessionId: SessionId;
    sessionToken: PlainSessionToken;
  },
  AuthenticationError | GenericError
> =
  (deps) =>
  async ({ payload }) => {
    const headers = payload.headers as { authorization?: string } | undefined;
    const parsedBearerToken = BearerSessionTokenSchema.safeParse(
      headers?.authorization,
    );

    if (!parsedBearerToken.success) {
      // TODO: log the underlying error for debugging purposes
      console.warn(parsedBearerToken.error.message);
      return err(new AuthenticationError());
    }

    const maybeSession = await deps.sessionPort.findBySessionToken({
      hashedSessionToken: toHashedSessionToken(
        parsedBearerToken.data.sessionToken,
      ),
      sessionId: parsedBearerToken.data.sessionId,
    });
    if (maybeSession.isErr()) {
      switch (maybeSession.error.kind) {
        case "NotFoundError":
          // TODO: log the underlying error for debugging purposes
          console.warn(maybeSession.error.message);
          return err(new AuthenticationError());
        case "GenericError":
          // TODO: log the underlying error for debugging purposes
          console.error(maybeSession.error.message);
          return err(
            new GenericError("An error occurred while retrieving the session"),
          );
        default: {
          const _exhaustiveCheck: never = maybeSession.error;
          return err(
            new GenericError(
              "An unexpected error occurred while retrieving the session",
            ),
          );
        }
      }
    }

    return ok({
      session: maybeSession.value,
      sessionId: parsedBearerToken.data.sessionId,
      sessionToken: parsedBearerToken.data.sessionToken,
    });
  };
