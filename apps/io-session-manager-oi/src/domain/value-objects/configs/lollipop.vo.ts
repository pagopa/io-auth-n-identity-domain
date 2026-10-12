import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";
import { HttpUrlCodec } from "../../../utils/codec/url.js";

/**
 * Lollipop configuration schema.
 * Consists of the URL, base path, and API key for the Lollipop service.
 */
export const LollipopConfigSchema = z.object({
  LOLLIPOP_API_URL: HttpUrlCodec, // TODO: rename to LOLLIPOP_API_URL_ORIGIN (since that is what we currently expect)
  LOLLIPOP_API_BASE_PATH: NonEmptyStringSchema,
  LOLLIPOP_API_KEY: NonEmptyStringSchema,
});
