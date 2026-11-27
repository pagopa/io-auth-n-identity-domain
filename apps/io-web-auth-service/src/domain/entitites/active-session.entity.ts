import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import z from "zod";

import { SpidLevelSchema } from "../value-objects/login.vo.js";

export const ActiveSessionSchema = z.object({
  name: NonEmptyStringSchema,
  family_name: NonEmptyStringSchema,
  fiscal_number: FiscalCodeSchema,
  spid_level: SpidLevelSchema,
});
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;
