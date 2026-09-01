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

export const ReserveInputDTO = {
  body: z
    .object({
      env: OidcConfigurationEnvSchema.meta({
        id: "OidcConfigurationEnv",
        description: "The OneIdentity configuration environment.",
      }),
      min_auth_level: SpidAuthLevel.meta({
        id: "SpidAuthLevel",
        description: "The SPID authentication level.",
      }),
      lollipop_pub_key: JwkPublicKeyBase64UrlStringSchema.meta({
        description:
          "The Lollipop public key, encoded as a Base64url JSON JWK.",
      }),
      lollipop_hash_algo: LollipopJwkHashingAlgorithmSchema.meta({
        id: "LollipopHashAlgorithm",
        description:
          "Hashing algorithm used to compute the JWK thumbprint of the Lollipop public key.",
      }),
      login_type: LoginTypeSchema.default("LEGACY").meta({
        id: "LoginType",
        description: "The login type requested by the client.",
      }),
      current_user: CurrentUserSchema.meta({
        description: "Optional identifier of the user currently logged in.",
      }),
    })
    .meta({
      id: "ReserveRequest",
      description:
        "Parameters needed to reserve a Lollipop public key and start the OIDC authorization flow.",
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
