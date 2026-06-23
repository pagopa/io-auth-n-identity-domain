import { sendErrorResponse } from "@pagopa/io-core-adapter-fastify";
import type { FiscalCode } from "@pagopa/io-core-domain";
import { ValidationError } from "@pagopa/io-core-domain/errors";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { LollipopContext } from "../../../../domain/entities/lollipop.js";
import { LollipopRequiredHeadersSchema } from "../../../../domain/entities/lollipop.js";
import type { GetLcParams } from "../../../../domain/ports/lollipop-consumer.port.js";

// ---------------------------------------------------------------------------
// Fastify request augmentation
// ---------------------------------------------------------------------------

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Lollipop context populated by `createLollipopHook` for signed endpoints.
     * Undefined on routes that do not require lollipop authentication.
     */
    lollipopContext?: LollipopContext;
  }
}

// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------

/**
 * Creates a Fastify `preHandler` hook that enforces lollipop authentication
 * on SSO endpoints.
 *
 * The hook:
 * 1. Validates the required lollipop headers from the inbound request.
 * 2. Calls the injected `getLcParams` port to resolve LC params from the
 *    lollipop function API (optionally using the caller's fiscal code).
 * 3. Stores the validated headers and LC params in `request.lollipopContext`
 *    for downstream handlers to consume.
 *
 * Mirrors the `expressLollipopMiddleware` used in `io-session-manager`.
 *
 * @param getLcParams  - Port implementation that resolves LC params.
 * @param getFiscalCode - Optional extractor for the authenticated user's fiscal
 *                       code. When provided and the request carries a valid user,
 *                       the assertion ref stored in Redis is validated against
 *                       the key thumbprint in the signature.
 */
export const createLollipopHook =
  (
    getLcParams: GetLcParams,
    getFiscalCode?: (request: FastifyRequest) => FiscalCode | undefined,
  ) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // --- 1. Validate required lollipop headers ---
    const headersResult = LollipopRequiredHeadersSchema.safeParse(
      request.headers,
    );

    if (!headersResult.success) {
      request.log.error(
        { issues: headersResult.error.issues },
        "lollipopHook: missing or invalid lollipop headers",
      );
      sendErrorResponse(
        reply,
        new ValidationError(
          headersResult.error.issues[0]?.message ??
            "Missing or invalid lollipop headers",
        ),
      );
      return;
    }

    const lollipopHeaders = headersResult.data;
    const fiscalCode = getFiscalCode?.(request);

    // --- 2. Resolve LC params via the port ---
    const lcParamsResult = await getLcParams(lollipopHeaders, fiscalCode);

    if (lcParamsResult.isErr()) {
      request.log.error(
        { error: lcParamsResult.error.message },
        "lollipopHook: failed to resolve LC params",
      );
      sendErrorResponse(reply, lcParamsResult.error);
      return;
    }

    // --- 3. Store context for downstream handlers ---
    request.lollipopContext = {
      lcParams: lcParamsResult.value,
      requestHeaders: lollipopHeaders,
    };
  };
