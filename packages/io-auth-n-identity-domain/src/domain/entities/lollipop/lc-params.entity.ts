import { z } from "zod";

import { FiscalCodeSchema } from "@pagopa/io-core-domain";

import {
  AssertionType,
  LollipopAssertionRefSchema,
  LollipopPublicKeySchema,
} from "../../value-objects/index.js";

/**
 * LC (Lollipop Consumer) params returned by the lollipop function API.
 * Field names mirror the API response payload from `generateLCParams`.
 */
export const LcParamsSchema = z.object({
  assertion_ref: LollipopAssertionRefSchema,

  assertion_type: AssertionType,

  lc_authentication_bearer: z.string().min(1),

  pub_key: LollipopPublicKeySchema,

  fiscal_code: FiscalCodeSchema,
});

export type LcParams = z.infer<typeof LcParamsSchema>;
