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
  async ({ payload }) => {
    const headers = payload.headers as
      | Record<string, string | undefined>
      | undefined;

    if (headers?.authorization === undefined) {
      return ok({});
    }

    const result = await authenticateSession({ payload, context: {} });
    return result.isErr() ? ok({}) : ok(result.value);
  };
