import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { LoginTypeSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

export const GetSessionStateInputDTO = z.object({
  fiscalCode: FiscalCodeSchema,
});

const SessionInfoDTO = z.discriminatedUnion("active", [
  z
    .object({
      active: z.literal(false),
    })
    .strict(),
  z
    .object({
      active: z.literal(true),
      expiration_date: z.iso.datetime(),
      type: LoginTypeSchema,
    })
    .strict(),
]);

export const GetSessionStateOutputDTO = z
  .object({
    access_enabled: z.boolean(),
    session_info: SessionInfoDTO,
  })
  .strict()
  .meta({
    description: "The user's access status and active session information.",
  });
