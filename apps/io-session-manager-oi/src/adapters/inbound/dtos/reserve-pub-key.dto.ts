import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  LollipopJwkSchema,
  LollipopJwkHashingAlgorithmSchema,
  LollipopAssertionRefSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import {
  JwkPublicKeyString,
  LollipopHashAlgorithm,
} from "../../../domain/entities/lollipop.js";
import {
  CurrentUser,
  LoginType,
  SpidAuthLevel,
} from "../../../domain/entities/login.js";
import { OidcConfigurationEnv } from "../../../domain/entities/oidc.js";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";

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

export const ReserveInputSchema = {
  headers: z.object({
    "x-pagopa-lollipop-hash-algorithm": LollipopHashAlgorithm,
    "x-pagopa-lollipop-pub-key": JwkPublicKeyString,
    "x-pagopa-login-type": LoginType,
    "x-pagopa-current-user": CurrentUser,
  }),
  query: z.object({
    env: OidcConfigurationEnv,
    authLevel: SpidAuthLevel,
  }),
};

export const ReserveOutputSchema = z.object({
  clientId: NonEmptyStringSchema,
  state: NonEmptyStringSchema,
  nonce: NonEmptyStringSchema,
  redirectUri: NonEmptyStringSchema,
  oneIdBaseUrl: NonEmptyStringSchema,
});
