import {
  EmailAddress,
  FiscalCode,
  NonEmptyString,
} from "@pagopa/hexagonal-core";

import {
  IsInboxEnabledSchema,
  IsWebhookEnabledSchema,
  PreferredLanguageSchema,
  PreferredLanguagesEnum,
  ServicesPreferencesModeEnum,
  ServicesPreferencesModeSchema,
  IsEmailEnabledSchema,
  IsEmailValidatedSchema,
  IsTestProfileSchema,
  BlockedInboxOrChannelsSchema,
  PreferredLanguagesSchema,
  PushNotificationsContentTypeSchema,
  AcceptedTosVersionSchema,
  ReminderStatusSchema,
  AppVersionSchema,
} from "../value-objects/profile/profile.vo.js";
import { EmailAddressSchema } from "@pagopa/hexagonal-core";

import { z } from "zod";

// NOTE: the following types are untested.
// Please verify and move those inside a dedicated profile entity when needed
const ServicePreferencesSettingsSchema = z.object({
  mode: ServicesPreferencesModeSchema,
});
type ServicePreferencesSettingsSchema = z.infer<
  typeof ServicePreferencesSettingsSchema
>;

const ExtendedProfileBase = z.object({
  is_email_enabled: IsEmailEnabledSchema,
  is_email_validated: IsEmailValidatedSchema,
  is_email_already_taken: z.boolean().default(false),
  is_inbox_enabled: IsInboxEnabledSchema,
  is_webhook_enabled: IsWebhookEnabledSchema,
  service_preferences_settings: ServicePreferencesSettingsSchema,
  version: z.number().int(),
});

const ExtendedProfileSchema = ExtendedProfileBase.extend({
  email: EmailAddressSchema.optional(),
  blocked_inbox_or_channels: BlockedInboxOrChannelsSchema.optional(),
  preferred_languages: PreferredLanguagesSchema.optional(),
  accepted_tos_version: AcceptedTosVersionSchema.optional(),
  reminder_status: ReminderStatusSchema.optional(),
  is_test_profile: IsTestProfileSchema.optional(),
  last_app_version: AppVersionSchema.optional(),
  push_notifications_content_type:
    PushNotificationsContentTypeSchema.optional(),
});
type ExtendedProfileSchema = z.infer<typeof ExtendedProfileSchema>;

export const aCustomEmailAddress = "custom-email@example.com" as EmailAddress;

export const anIsInboxEnabled = true as IsInboxEnabledSchema;
export const anIsWebookEnabled = true as IsWebhookEnabledSchema;
export const aPreferredLanguages: Array<PreferredLanguageSchema> = [
  PreferredLanguagesEnum.it_IT,
];
export const aServicePreferencesSettings: ServicePreferencesSettingsSchema = {
  mode: ServicesPreferencesModeEnum.AUTO,
};

export const aValidName = "Giuseppe Maria" as NonEmptyString;
export const aValidFamilyname = "Garibaldi" as NonEmptyString;
export const aFiscalCode = "ISPXNB32R82Y766D" as FiscalCode;

export const mockedInitializedProfile = {
  email: aCustomEmailAddress,
  family_name: aValidFamilyname,
  fiscal_code: aFiscalCode,
  has_profile: true,
  is_email_enabled: true,
  is_email_validated: true,
  is_email_already_taken: true,
  is_inbox_enabled: anIsInboxEnabled,
  is_webhook_enabled: anIsWebookEnabled,
  name: aValidName,
  preferred_languages: aPreferredLanguages,
  service_preferences_settings: aServicePreferencesSettings,
  version: 42,
};

export const mockedExtendedProfile: ExtendedProfileSchema = {
  ...mockedInitializedProfile,
  is_email_already_taken: false,
  is_email_validated: true,
  blocked_inbox_or_channels: {},
};
