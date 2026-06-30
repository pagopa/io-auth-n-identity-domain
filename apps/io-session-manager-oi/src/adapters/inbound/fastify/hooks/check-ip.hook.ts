import { ForbiddenError, ValidationError } from "@pagopa/hexagonal-core/domain/errors";
import { sendErrorResponse } from "@pagopa/hexagonal-fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as rangeCheck from "range_check";
import { z } from "zod";

const IPSchema = z.union([z.ipv4(), z.ipv6()]);

/**
 * Extracts the client IP from the Fastify request.
 * Falls back to the `x-client-ip` header for internal calls (same VNet).
 */
const extractIP = (request: FastifyRequest): string | undefined => {
  if (IPSchema.safeParse(request.ip).success) {
    return request.ip;
  }

  // Use x-client-ip instead of x-forwarded-for for internal calls (same VNet)
  const clientIpHeader = request.headers["x-client-ip"];
  const clientIp = Array.isArray(clientIpHeader)
    ? clientIpHeader[0]
    : clientIpHeader;

  if (clientIp !== undefined && IPSchema.safeParse(clientIp).success) {
    return clientIp;
  }

  return undefined;
};

/**
 * Creates a Fastify preHandler hook that blocks requests whose source IP
 * is not within the given CIDR allowlist. Responds with RFC 7807
 * Problem+JSON errors, consistent with the rest of the service.
 *
 * Mirrors the `checkIP` Express middleware used in `io-session-manager`.
 *
 * Note: for `request.ip` to reflect the real client IP behind a proxy,
 * Fastify must be started with `trustProxy: true`.
 */
export const createCheckIpHook =
  (allowedCIDRs: ReadonlyArray<string>) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const ip = extractIP(request);

    if (ip === undefined) {
      request.log.error(
        `Cannot decode source IP: ip=${request.ip}, x-client-ip=${request.headers["x-client-ip"]}`,
      );
      sendErrorResponse(
        reply,
        new ValidationError("Unable to parse client IP address."),
      );
      return;
    }

    if (!rangeCheck.inRange(ip, Array.from(allowedCIDRs))) {
      request.log.error(`Blocked source IP ${ip}.`);
      sendErrorResponse(reply, new ForbiddenError());
      return;
    }
  };
