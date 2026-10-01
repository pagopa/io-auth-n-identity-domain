import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

extendZodWithOpenApi(z);

export const SsoZendeskTokenInputDTO = {
  body: z
    .object({
      user_token: NonEmptyStringSchema,
    })
    .meta({
      id: "ZendeskTokenRequest",
      description: "Request to obtain a Zendesk support token.",
    }),
};

export const SsoZendeskTokenOutputDTO = z
  .object({
    jwt: NonEmptyStringSchema,
  })
  .meta({
    id: "ZendeskToken",
    description: "A Support Token response to authenticate to Zendesk.",
  });
