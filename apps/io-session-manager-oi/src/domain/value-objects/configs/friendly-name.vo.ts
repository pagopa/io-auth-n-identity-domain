import z from "zod";
import { HttpUrlCodec } from "../../../utils/codec/url.js";

  export const FriendlyNameConfigSchema = z.object({
    IDP_FRIENDLY_NAMES_PROD_URL: HttpUrlCodec,
    IDP_FRIENDLY_NAMES_UAT_URL: HttpUrlCodec,
    IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS: z.coerce.number().int().positive(),
  });
