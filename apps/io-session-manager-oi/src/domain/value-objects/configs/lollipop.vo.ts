import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { HttpUrlCodec } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";


/**
 * Lollipop configuration schema.
 * Consists of the URL, base path, and API key for the Lollipop service.
 */
export const LollipopConfigSchema = z.object({
  LOLLIPOP_API_URL: HttpUrlCodec, // TODO: rename to LOLLIPOP_API_URL_ORIGIN (since that is what we currently expect)
  LOLLIPOP_API_BASE_PATH: NonEmptyStringSchema,
  LOLLIPOP_API_KEY: NonEmptyStringSchema,
});
