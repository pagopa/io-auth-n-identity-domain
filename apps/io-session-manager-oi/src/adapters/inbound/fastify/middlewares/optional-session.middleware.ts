import type {
  AuthenticationError,
  EmptyHttpMiddlewareContext,
  GenericError,
  HttpRequestMiddleware,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import type {
  AuthenticationContext,
  AuthenticationMiddleware,
} from "../../../../middlewares/authentication/index.js";

export type OptionalSessionContext =
  | AuthenticationContext<"session">
  | EmptyHttpMiddlewareContext;

export type OptionalSessionMiddleware = HttpRequestMiddleware<
  EmptyHttpMiddlewareContext,
  OptionalSessionContext,
  AuthenticationError | GenericError
>;

export const optionalSessionMiddleware =
  (
    authenticateSession: AuthenticationMiddleware<"session">,
  ): OptionalSessionMiddleware =>
  async ({ payload, context }) => {
    const headers = payload.headers as
      | Record<string, string | undefined>
      | undefined;

    if (!headers?.authorization) {
      return ok({});
    }

    const result = await authenticateSession({ payload, context });
    if (result.isErr()) {
      return result.error.kind === "AuthenticationError"
        ? ok({})
        : err(result.error);
    }

    return ok(result.value);
  };
