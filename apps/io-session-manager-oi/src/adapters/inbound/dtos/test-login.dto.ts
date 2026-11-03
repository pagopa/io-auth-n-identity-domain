import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  JwkPublicKeyBase64UrlStringSchema,
  LollipopJwkHashingAlgorithmSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { LoginTypeSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

extendZodWithOpenApi(z);

const PasswordLoginSchema = z.object({
  username: FiscalCodeSchema,
  password: NonEmptyStringSchema,
});

const LollipopSchema = z.object({
  lollipop_pub_key: JwkPublicKeyBase64UrlStringSchema.meta({
    description: "The Lollipop public key, encoded as a Base64url JSON JWK.",
  }),
  lollipop_hash_algo: LollipopJwkHashingAlgorithmSchema.meta({
    id: "LollipopHashAlgorithm",
    description:
      "Hashing algorithm used to compute the JWK thumbprint of the Lollipop public key.",
  }),
});

const LoginType = LoginTypeSchema.default("LEGACY").meta({
  id: "LoginType",
  description: "The login type requested by the client.",
});

// DTO containing PasswordLoginSchema, LollipopSchema and LoginType in the body
export const TestLoginInputDTO = {
  body: z
    .object({
      ...PasswordLoginSchema.shape,
      ...LollipopSchema.shape,
      login_type: LoginType,
    })
    .meta({
      id: "TestLoginInput",
      description: "Input for the test login endpoint.",
    }),
};

export const TestLoginOutputDTO = z
  .object({
    access_token: NonEmptyStringSchema,
  })
  .meta({
    id: "TestLoginOutput",
    description: "Access Token obtained after a successful test login.",
  });
