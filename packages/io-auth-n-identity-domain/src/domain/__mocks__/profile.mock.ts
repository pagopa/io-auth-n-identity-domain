import {
  EmailAddress,
  FiscalCode,
  NonEmptyString,
} from "@pagopa/hexagonal-core";

import { ExtendedProfileSchema, ServicePreferencesSettingsSchema } from "../entities/profile.entity.js";
import {
  IsInboxEnabledSchema,
  IsWebhookEnabledSchema,
  PreferredLanguageSchema,
  PreferredLanguagesEnum,
  ServicesPreferencesModeEnum,
} from "../value-objects/profile/profile.value-object.js";

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
