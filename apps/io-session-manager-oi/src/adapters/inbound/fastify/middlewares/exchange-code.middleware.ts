import {
  AuthenticationError,
  GenericError,
  type HttpRequestMiddleware,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { z } from "zod";

import { type OidcPort } from "../../../../domain/ports/outbound/oidc.port.js";
import { type OidcClaims } from "../../../../domain/value-objects/oidc-claims.vo.js";
import { type AusiliarDataContext } from "./retrieve-ausiliar-data.middleware.js";

/** Context contribution produced by {@link makeExchangeCodeMiddleware}. */
export type ClaimsContext = {
  claims: OidcClaims;
};

const CallbackQuerySchema = z.object({
  code: NonEmptyStringSchema,
  state: NonEmptyStringSchema,
});

/**
 * Exchanges the OIDC authorization code for tokens and returns the validated
 * ID token claims. Runs after {@link makeRetrieveAusiliarDataMiddleware}, whose
 * auxiliary data provides the expected nonce and target environment.
 */
export const makeExchangeCodeMiddleware =
  (
    oidcExchangePort: OidcPort,
  ): HttpRequestMiddleware<
    AusiliarDataContext,
    ClaimsContext,
    AuthenticationError | GenericError
  > =>
  async ({ context, payload }) => {
    const parsedQuery = CallbackQuerySchema.safeParse(payload.query);
    if (!parsedQuery.success) {
      return err(new AuthenticationError());
    }

    const exchangeResult = await oidcExchangePort.exchange({
      env: context.ausiliarData.oidcConfigurationEnv,
      query: parsedQuery.data,
      expectedState: parsedQuery.data.state,
      expectedNonce: context.ausiliarData.nonce,
    });

    if (exchangeResult.isErr()) {
      return err(exchangeResult.error);
    }

    return ok({ claims: exchangeResult.value });
  };
