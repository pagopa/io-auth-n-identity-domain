import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const GetSessionOutputDTO = z
  .object({
    active: z.boolean(),
  })
  .meta({
    description: "Boolean indicating whether the session is active or not.",
  });
