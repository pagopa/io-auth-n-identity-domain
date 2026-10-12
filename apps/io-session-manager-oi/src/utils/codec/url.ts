import { z } from "zod";

export const HttpUrlCodec = z.codec(
  z.url({
    protocol: /^https?$/,
  }),
  z.instanceof(URL),
  {
    decode: (value) => new URL(value),
    encode: (value) => value.toString(),
  },
);
