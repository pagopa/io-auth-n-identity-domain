import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { FimsUserSchema } from "../../../domain/value-objects/fims.vo.js";

extendZodWithOpenApi(z);

export const SsoFimsUserOutputDTO = FimsUserSchema.meta({
  id: "FIMSUser",
  description: "The user data returned to the FIMS backend.",
});
