import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  LollipopMethodSchema,
  LollipopOriginalUrlSchema,
  LollipopSignatureInputSchema,
  LollipopSignatureSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

extendZodWithOpenApi(z);

export const FastLoginInputDTO = {
  headers: z
    .object({
      authorization: z.string().optional().meta({
        description:
          "Optional bearer session token used to bind Fast Login to the current user.",
      }),
      "x-pagopa-lollipop-original-method": LollipopMethodSchema,
      "x-pagopa-lollipop-original-url": LollipopOriginalUrlSchema,
      "signature-input": LollipopSignatureInputSchema,
      signature: LollipopSignatureSchema,
    })
    .meta({
      id: "FastLoginHeaders",
      description: "Signed Lollipop request headers for Fast Login.",
    }),
};

export const FastLoginOutputDTO = z
  .object({
    token: NonEmptyStringSchema,
  })
  .meta({
    id: "FastLoginResponse",
    description: "The newly created session token.",
  });
