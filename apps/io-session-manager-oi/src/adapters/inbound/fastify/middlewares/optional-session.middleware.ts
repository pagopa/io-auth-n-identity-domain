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

export type OptionalSessionMiddleware = HttpRequestMiddleware<
  EmptyHttpMiddlewareContext,
  AuthenticationContext<"session"> | EmptyHttpMiddlewareContext,
  AuthenticationError | GenericError
>;

export const optionalSessionMiddleware =
  (
    authenticateSession: AuthenticationMiddleware<"session">,
  ): OptionalSessionMiddleware =>
  async ({ payload }) => {
    const headers = payload.headers as
      | Record<string, string | undefined>
      | undefined;

    if (headers?.authorization === undefined) {
      return ok({});
    }

    const result = await authenticateSession({ payload, context: {} });
    return result.isErr() ? err(result.error) : ok(result.value);
  };
