import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  LollipopAssertionRefSchema,
  LollipopPublicKeyHeadersSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

extendZodWithOpenApi(z);

export const ReservePubKeyHeadersSchema = LollipopPublicKeyHeadersSchema.meta({
  description: "Headers for reserving a lollipop public key.",
  id: "ReservePubKeyHeaders",
});

export type ReservePubKeyHeaders = z.infer<typeof ReservePubKeyHeadersSchema>;

export const ReservePubKeyOutputSchema = z
  .object({
    assertion_ref: LollipopAssertionRefSchema.meta({
      description: "The reserved assertion reference (algo-thumbprint).",
    }),
  })
  .meta({
    description: "Successful reservation of the lollipop public key.",
    id: "ReservePubKeyOutput",
  });

export type ReservePubKeyOutput = z.infer<typeof ReservePubKeyOutputSchema>;
