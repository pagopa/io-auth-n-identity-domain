import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * Platform Proxy Internal API configuration schema.
 * Consists of the host URL and the OpenAPI base path. No API key is required.
 */
export const PlatformProxyConfigSchema = z.object({
  PLATFORM_PROXY_API_URL: z.url(),
  PLATFORM_PROXY_API_BASE_PATH: NonEmptyStringSchema,
});
