import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRefSchema,
  LollipopJwkSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import { FimsUserSchema } from "./sso-fims-user.dto.js";

extendZodWithOpenApi(z);

export const SsoFimsLollipopUserInputDto = {
  body: z
    .object({
      operation_id: NonEmptyStringSchema,
    })
    .meta({
      id: "GetLollipopUserForFimsPayload",
      description: "Input payload for fetching FIMS Lollipop user",
    }),
};

const LcParamsForFimsSchema = z
  .object({
    assertion_ref: LollipopAssertionRefSchema,
    pub_key: LollipopJwkSchema,
    lc_authentication_bearer: NonEmptyStringSchema,
  })
  .meta({
    id: "LcParamsForFims",
    description: "LC Params for FIMS",
  });

const FimsPlusUserSchema = z
  .object({
    profile: FimsUserSchema,
    lc_params: LcParamsForFimsSchema,
  })
  .meta({
    id: "FIMSPlusUser",
    description: "FIMS User with additional LCParamsForFims",
  });

export const SsoFimsLollipopUserOutputDto = FimsPlusUserSchema;
