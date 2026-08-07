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
  LoginTypeSchema,
  SpidAuthLevel,
} from "../../../domain/value-objects/login.vo.js";
import { OidcConfigurationEnvSchema } from "../../../domain/value-objects/oidc.vo.js";

extendZodWithOpenApi(z);

export const ReserveInputDTO = {
  headers: z.object({
    "x-pagopa-lollipop-hash-algorithm": LollipopJwkHashingAlgorithmSchema,
    "x-pagopa-lollipop-pub-key": JwkPublicKeyBase64UrlStringSchema,
    "x-pagopa-login-type": LoginTypeSchema,
    "x-pagopa-current-user": CurrentUserSchema,
  }),
  query: z.object({
    env: OidcConfigurationEnvSchema,
    authLevel: SpidAuthLevel,
  }),
};

export const ReserveOutputDTO = z.object({
  client_id: NonEmptyStringSchema,
  state: NonEmptyStringSchema,
  nonce: NonEmptyStringSchema,
  redirect_uri: NonEmptyStringSchema,
  issuer: NonEmptyStringSchema,
});
