import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";
import { HttpUrlCodec } from "../../../utils/codec/url.js";

/*
 * IO Fast Login configuration schema.
 * Consists of the URL, base path, and API key for the IO Fast Login service.
 */
export const IoFastLoginConfigSchema = z.object({
  IO_FAST_LOGIN_API_URL: HttpUrlCodec, // TODO: rename to IO_FAST_LOGIN_API_URL_ORIGIN (since that is what we currently expect)
  IO_FAST_LOGIN_API_BASE_PATH: NonEmptyStringSchema,
  IO_FAST_LOGIN_API_KEY: NonEmptyStringSchema,
});
