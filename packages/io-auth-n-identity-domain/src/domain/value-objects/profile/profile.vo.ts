import { EmailAddressSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const IsEmailValidatedSchema = z.boolean();
export type IsEmailValidatedSchema = z.infer<typeof IsEmailValidatedSchema>;

export const IsEmailEnabledSchema = z.boolean();
export type IsEmailEnabledSchema = z.infer<typeof IsEmailEnabledSchema>;

export const IsInboxEnabledSchema = z.boolean();
export type IsInboxEnabledSchema = z.infer<typeof IsInboxEnabledSchema>;

export const IsWebhookEnabledSchema = z.boolean();
export type IsWebhookEnabledSchema = z.infer<typeof IsWebhookEnabledSchema>;

export const IsTestProfileSchema = z.boolean().default(false);
export type IsTestProfileSchema = z.infer<typeof IsTestProfileSchema>;

export const AcceptedTosVersionSchema = z.number().min(1);
export type AcceptedTosVersionSchema = z.infer<typeof AcceptedTosVersionSchema>;

export enum ReminderStatusEnum {
  "ENABLED" = "ENABLED",
  "DISABLED" = "DISABLED",
}
export const ReminderStatusSchema = z.enum(ReminderStatusEnum);
export type ReminderStatusSchema = z.infer<typeof ReminderStatusSchema>;

export enum BlockedInboxOrChannelEnum {
  "EMAIL" = "EMAIL",
  "INBOX" = "INBOX",
  "WEBHOOK" = "WEBHOOK",
}
export const BlockedInboxOrChannelSchema = z.enum(BlockedInboxOrChannelEnum);
export type BlockedInboxOrChannelSchema = z.infer<
  typeof BlockedInboxOrChannelSchema
>;

export const BlockedInboxOrChannelsSchema = z.record(
  z.string(),
  z.array(BlockedInboxOrChannelSchema),
);
export type BlockedInboxOrChannelsSchema = z.infer<
  typeof BlockedInboxOrChannelsSchema
>;

export enum PreferredLanguagesEnum {
  "it_IT" = "it_IT",
  "en_GB" = "en_GB",
  "es_ES" = "es_ES",
  "de_DE" = "de_DE",
  "fr_FR" = "fr_FR",
}

export const PreferredLanguageSchema = z.enum(PreferredLanguagesEnum);
export type PreferredLanguageSchema = z.infer<typeof PreferredLanguageSchema>;

export const PreferredLanguagesSchema = z.array(PreferredLanguageSchema);
export type PreferredLanguagesSchema = z.infer<typeof PreferredLanguagesSchema>;

export enum ServicesPreferencesModeEnum {
  "LEGACY" = "LEGACY",
  "AUTO" = "AUTO",
  "MANUAL" = "MANUAL",
}
export const ServicesPreferencesModeSchema = z.enum(
  ServicesPreferencesModeEnum,
);
export type ServicesPreferencesModeSchema = z.infer<
  typeof ServicesPreferencesModeSchema
>;

export const AppVersionSchema = z
  .string()
  .regex(/^((0|[1-9]\d*)\.){2}(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,1}$/);
export type AppVersionSchema = z.infer<typeof AppVersionSchema>;

export enum PushNotificationsContentTypeEnum {
  "FULL" = "FULL",
  "ANONYMOUS" = "ANONYMOUS",
}
export const PushNotificationsContentTypeSchema = z.enum(
  PushNotificationsContentTypeEnum,
);
export type PushNotificationsContentTypeSchema = z.infer<
  typeof PushNotificationsContentTypeSchema
>;

const NewProfileBase = z.object({
  is_email_validated: IsEmailValidatedSchema,
});

export const NewProfile = NewProfileBase.extend({
  email: EmailAddressSchema.optional(),
  is_test_profile: IsTestProfileSchema.optional(),
});
export type NewProfile = z.infer<typeof NewProfile>;
