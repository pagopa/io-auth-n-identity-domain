import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const GenerateNonceOutputDTO = z
  .object({
    nonce: z.uuid(),
  })
  .meta({
    id: "GenerateNonceResponse",
    description: "An object containing the generated nonce as a UUID",
  });
export type GenerateNonceOutputDTO = z.infer<typeof GenerateNonceOutputDTO>;
