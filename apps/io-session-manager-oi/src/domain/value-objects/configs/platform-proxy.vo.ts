import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";
import { HttpUrlCodec } from "../../../utils/codec/url.js";

/**
 * Platform Proxy Internal API configuration schema.
 * Consists of the host URL and the OpenAPI base path. No API key is required.
 */
export const PlatformProxyConfigSchema = z.object({
  PLATFORM_PROXY_API_URL: HttpUrlCodec, // TODO: rename to PLATFORM_PROXY_API_URL_ORIGIN (since that is what we currently expect)
  PLATFORM_PROXY_API_BASE_PATH: NonEmptyStringSchema,
});
