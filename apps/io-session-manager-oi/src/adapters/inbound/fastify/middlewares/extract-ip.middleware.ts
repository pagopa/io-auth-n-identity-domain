import {
  type EmptyHttpMiddlewareContext,
  type HttpRequestMiddleware,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  IPStringSchema,
  type IPString,
} from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";

/** Context contribution produced by {@link extractIpMiddleware}. */
export type IpContext = {
  ipAddress: IPString;
};

/**
 * Extracts the client IP from `x-forwarded-for`, falling back to `x-client-ip`
 * for internal calls on the same VNet. A missing or malformed value on both
 * headers is rejected as a validation error.
 *
 * NOTE: This middleware need `normalizeClientIpHook` to be registered before it,
 * so that `x-client-ip` is populated with the value of `request.ip`
 * when no IP header is present (e.g. local calls that do not go through a proxy).
 */
export const extractIpMiddleware: HttpRequestMiddleware<
  EmptyHttpMiddlewareContext,
  IpContext,
  ValidationError
> = async ({ payload }) => {
  const headers = payload.headers as Record<string, string | undefined>;

  // With trust proxy the client IP is the leftmost `x-forwarded-for` entry.
  const forwardedFor = headers["x-forwarded-for"]?.split(",")[0]?.trim();

  const parsed = IPStringSchema.safeParse(forwardedFor);
  const result = parsed.success
    ? parsed
    : IPStringSchema.safeParse(headers["x-client-ip"]);

  if (!result.success) {
    return err(new ValidationError("Missing or invalid client IP address."));
  }

  return ok({ ipAddress: result.data });
};
