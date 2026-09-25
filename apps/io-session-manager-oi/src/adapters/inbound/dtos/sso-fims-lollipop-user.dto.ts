import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { FimsUserSchema, LCParamsForFims } from "../../../domain/value-objects/fims.vo.js";

extendZodWithOpenApi(z);

export const SsoFimsLollipopUserInputDto = {
  body: z
    .object({
      operation_id: NonEmptyStringSchema,
    })
    .meta({
      id: "GetLollipopUserForFIMSPayload",
      description: "Input payload for fetching FIMS Lollipop user",
    }),
};

export const SsoFimsLollipopUserOutputDto = z.object({
  profile: FimsUserSchema,
  lc_params: LCParamsForFims,
}).meta({
  id: "FIMSPlusUser",
  description: "FIMS User with additional LCParamsForFims",
});
