import { IPStringSchema } from "@pagopa/io-auth-n-identity-domain";
import type { FastifyRequest } from "fastify";

/**
 * Bridges Fastify's `request.ip` (resolved via `trustProxy`) into the
 * `x-client-ip` header, so hexagonal middlewares — which only see the request
 * payload, not the raw request — can resolve the client IP. Runs only when no
 * IP header is present, e.g. local calls that do not go through a proxy.
 */
export const normalizeClientIpHook = async (
  request: FastifyRequest,
): Promise<void> => {
  if (
    request.headers["x-forwarded-for"] === undefined &&
    request.headers["x-client-ip"] === undefined &&
    IPStringSchema.safeParse(request.ip).success
  ) {
    request.headers["x-client-ip"] = request.ip;
  }
};
