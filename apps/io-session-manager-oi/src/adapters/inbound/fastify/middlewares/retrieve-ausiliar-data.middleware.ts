import {
  AuthenticationError,
  type EmptyHttpMiddlewareContext,
  GenericError,
  type HttpRequestMiddleware,
  NonEmptyStringSchema,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { z } from "zod";

import { type AusiliarDataPort } from "../../../../domain/ports/outbound/ausiliar-data.port.js";
import { type LoginAusiliarData } from "../../../../domain/value-objects/login.vo.js";

/** Context contribution produced by {@link makeRetrieveAusiliarDataMiddleware}. */
export type AusiliarDataContext = {
  ausiliarData: LoginAusiliarData;
};

const StateSchema = z.object({ state: NonEmptyStringSchema });

/**
 * Reads the login auxiliary data reserved at the start of the flow, keyed by
 * the `state` query parameter. A missing/expired `state` is treated as an
 * authentication failure; an infrastructure error surfaces as a generic error.
 */
export const makeRetrieveAusiliarDataMiddleware =
  (
    ausiliarDataPort: AusiliarDataPort,
  ): HttpRequestMiddleware<
    EmptyHttpMiddlewareContext,
    AusiliarDataContext,
    AuthenticationError | GenericError
  > =>
  async ({ payload }) => {
    const parsedState = StateSchema.safeParse(payload.query);
    if (!parsedState.success) {
      return err(new AuthenticationError());
    }

    const retrieveResult = await ausiliarDataPort.retrieve(
      parsedState.data.state,
    );
    if (retrieveResult.isErr()) {
      return retrieveResult.error instanceof NotFoundError
        ? err(new AuthenticationError())
        : err(new GenericError(retrieveResult.error.message));
    }

    return ok({ ausiliarData: retrieveResult.value });
  };
