import { z } from "zod";

import { LcParamsSchema } from "./lc-params.entity.js";
import { LollipopRequiredHeadersSchema } from "./lollipop-required-headers.entity.js";

/**
 * Full lollipop context, combining the required headers and the LC params.
 */
export const LollipopContextSchema = z.object({
  /** Validated lollipop request headers */
  requestHeaders: LollipopRequiredHeadersSchema,
  /** LC params obtained from the lollipop service */
  lcParams: LcParamsSchema,
});

export type LollipopContext = z.infer<typeof LollipopContextSchema>;
