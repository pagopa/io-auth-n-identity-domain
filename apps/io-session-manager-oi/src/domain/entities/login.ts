import { z } from "zod";
import { LollipopAssertionRef } from "./lollipop.js";
import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
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
  lollipopAssertionRef: LollipopAssertionRef,
  clientId: NonEmptyStringSchema,
  authLevel: SpidAuthLevel,
});

export type LoginAusiliarData = z.infer<typeof LoginAusiliarData>;
