import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  LollipopJwkSchema,
  LollipopJwkHashingAlgorithmSchema,
  LollipopAssertionRefSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

extendZodWithOpenApi(z);

export const LollipopReservePublicKeyHeadersSchema = z
  .object({
    /** Base64url-encoded JWK public key */
    "x-pagopa-lollipop-pub-key": LollipopJwkSchema,

    /** Thumbprint hashing algorithm */
    "x-pagopa-lollipop-pub-key-hash-algo":
      LollipopJwkHashingAlgorithmSchema.optional(),
  })
  .meta({
    description: "Headers for reserving a lollipop public key.",
    id: "ReservePubKeyHeaders",
  });

export type LollipopReservePublicKeyHeaders = z.infer<
  typeof LollipopReservePublicKeyHeadersSchema
>;

export const LollipopReservePublicKeyResponseSchema = z
  .object({
    assertion_ref: LollipopAssertionRefSchema,
    pub_key: LollipopJwkSchema,
    status: z.enum(["PENDING", "VALID", "REVOKED"]),
    ttl: z.number().int().nonnegative(),
  })
  .meta({
    description: "The output of the reserve public key operation.",
    id: "ReservePubKeyResponse",
  });

export type LollipopReservePublicKeyResponse = z.infer<
  typeof LollipopReservePublicKeyResponseSchema
>;
