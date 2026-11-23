import { z } from "zod";

/**
 * Validates that a given URL has either "http:" or "https:" protocol.
 * This is useful for local development URLs that may not be accepted by `z.httpUrl()` (i.e.: a Docker service in a Docker Compose Network).
 */
const httpUrlSchema = z.url({
  protocol: /^https?$/,
});

export const HttpUrlCodec = z.codec(httpUrlSchema, z.instanceof(URL), {
  decode: (value) => new URL(value),
  encode: (value) => value.toString(),
});
