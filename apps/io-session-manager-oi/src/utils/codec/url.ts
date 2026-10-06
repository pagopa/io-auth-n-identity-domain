import { z } from "zod";

export const HttpUrlCodec = z.codec(z.httpUrl(), z.instanceof(URL), {
  decode: (value) => new URL(value),
  encode: (value) => value.toString(),
});
