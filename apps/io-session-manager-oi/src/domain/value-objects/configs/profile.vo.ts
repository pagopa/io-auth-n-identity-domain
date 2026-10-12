import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";
import { HttpUrlCodec } from "../../../utils/codec/url.js";

/**
 * IO Profile configuration schema.
 * Consists of the URL, base path, and API key for the IO Profile service.
 */
export const IoProfileConfigSchema = z.object({
  IO_PROFILE_API_URL: HttpUrlCodec, // TODO: rename to IO_PROFILE_API_URL_ORIGIN (since that is what we currently expect)
  IO_PROFILE_API_BASE_PATH: NonEmptyStringSchema,
  IO_PROFILE_API_KEY: NonEmptyStringSchema,
});
