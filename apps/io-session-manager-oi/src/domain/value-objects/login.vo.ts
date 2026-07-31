import { z } from "zod";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
export const SpidAuthLevel = z.union([
  z.literal("SpidL2"),
  z.literal("SpidL3"),
]);

export type SpidAuthLevel = z.infer<typeof SpidAuthLevel>;

export const LoginType = z
  .union([z.literal("LV"), z.literal("LEGACY")])
  .default("LEGACY");

export type LoginType = z.infer<typeof LoginType>;

export const CurrentUser = z.string().brand("LoginCurrentUser").optional();

export type CurrentUser = z.infer<typeof CurrentUser>;

export const LoginAusiliarData = z.object({
  loginType: LoginType,
  currentUser: CurrentUser,
  lollipopAssertionRef: LollipopAssertionRefSchema,
  clientId: NonEmptyStringSchema,
  minAuthLevel: SpidAuthLevel,
});

export type LoginAusiliarData = z.infer<typeof LoginAusiliarData>;
