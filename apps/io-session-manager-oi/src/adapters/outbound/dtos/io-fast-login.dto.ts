import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const FastLoginResponseDto = z.object({
  saml_response: NonEmptyStringSchema,
});
export type FastLoginResponseDto = z.infer<typeof FastLoginResponseDto>;
