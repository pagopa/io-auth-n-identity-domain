import { z } from "zod";

export const UrlCodec = z.codec(z.url(), z.instanceof(URL), {
  decode: (value) => new URL(value),
  encode: (value) => value.toString(),
});
