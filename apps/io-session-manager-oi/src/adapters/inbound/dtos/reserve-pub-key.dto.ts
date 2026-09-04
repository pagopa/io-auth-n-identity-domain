import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  NonEmptyStringSchema,
  NonEmptyStringBrand,
} from "@pagopa/hexagonal-core";
import {
  LollipopJwkHashingAlgorithmSchema,
  JwkPublicKeyBase64UrlStringSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import {
  CurrentUserSchema,
  SpidAuthLevel,
} from "../../../domain/value-objects/login.vo.js";
import { OidcConfigurationEnvSchema } from "../../../domain/value-objects/oidc.vo.js";
import { LoginTypeSchema } from "@pagopa/io-auth-n-identity-session";

extendZodWithOpenApi(z);

export const LoginTypeDTOSchema = LoginTypeSchema.default("LEGACY");

export const ReserveInputDTO = {
  headers: z.object({
    "x-pagopa-lollipop-hash-algorithm": LollipopJwkHashingAlgorithmSchema.meta({
      description:
        "Hashing algorithm used to compute the JWK thumbprint of the Lollipop public key.",
    }),
    "x-pagopa-lollipop-pub-key": JwkPublicKeyBase64UrlStringSchema.meta({
      description: "The Lollipop public key, encoded as a Base64url JSON JWK.",
    }),
    "x-pagopa-login-type": LoginTypeDTOSchema.meta({
      id: "LoginType",
      description: "The login type requested by the client.",
    }),
    "x-pagopa-current-user": CurrentUserSchema.meta({
      description: "Optional identifier of the user currently logged in.",
    }),
  }),
  query: z.object({
    env: OidcConfigurationEnvSchema.meta({
      id: "OidcConfigurationEnv",
      description: "The OneIdentity configuration environment.",
    }),
    authLevel: SpidAuthLevel.meta({
      id: "SpidAuthLevel",
      description: "The SPID authentication level.",
    }),
  }),
};

export const ReserveOutputDTO = z
  .object({
    client_id: NonEmptyStringSchema,
    state: NonEmptyStringSchema,
    nonce: NonEmptyStringSchema,
    redirect_uri: NonEmptyStringSchema,
    issuer: NonEmptyStringSchema,
  })
  .meta({
    id: "ReserveResponse",
    description: "The parameters needed to start the OIDC authorization flow.",
  });
