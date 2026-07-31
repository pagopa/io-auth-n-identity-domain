import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  LollipopJwkHashingAlgorithmSchema,
  JwkPublicKeyBase64UrlStringSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import {
  CurrentUser,
  LoginType,
  SpidAuthLevel,
} from "../../../domain/value-objects/login.vo.js";
import { OidcConfigurationEnv } from "../../../domain/value-objects/oidc.vo.js";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";

extendZodWithOpenApi(z);

export const ReserveInputDTO = {
  headers: z.object({
    "x-pagopa-lollipop-hash-algorithm": LollipopJwkHashingAlgorithmSchema,
    "x-pagopa-lollipop-pub-key": JwkPublicKeyBase64UrlStringSchema,
    "x-pagopa-login-type": LoginType,
    "x-pagopa-current-user": CurrentUser,
  }),
  query: z.object({
    env: OidcConfigurationEnv,
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
