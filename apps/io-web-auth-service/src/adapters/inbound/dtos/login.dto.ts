import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  IdpSchema,
  SpidAuthLevel,
} from "../../../domain/value-objects/login.vo.js";
import { OidcEnvironmentSchema } from "../../../domain/value-objects/oidc.vo.js";

extendZodWithOpenApi(z);

export const LoginInputDTO = {
  query: z.object({
    env: OidcEnvironmentSchema.default("PROD").meta({
      id: "OidcConfigurationEnv",
      description:
        "The OneIdentity configuration environment. Defaults to `PROD` when omitted.",
    }),
    min_auth_level: SpidAuthLevel.meta({
      id: "SpidAuthLevel",
      description: "The minimum SPID authentication level requested.",
    }),
    idp: IdpSchema.meta({
      description:
        "The identity provider the user wants to log in with, forwarded to OneIdentity.",
    }),
  }),
};
