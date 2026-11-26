import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const GetSessionInputDTO = z.object({
  fiscalCode: FiscalCodeSchema,
});

export const GetSessionOutputDTO = z
  .object({
    active: z.boolean(),
  })
  .strict()
  .meta({
    description: "Boolean indicating whether the user has an active session.",
  });
