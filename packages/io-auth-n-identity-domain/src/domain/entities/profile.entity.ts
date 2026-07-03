import { EmailAddressSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import {
  AcceptedTosVersionSchema,
  AppVersionSchema,
  BlockedInboxOrChannelsSchema,
  IsEmailEnabledSchema,
  IsEmailValidatedSchema,
  IsInboxEnabledSchema,
  IsTestProfileSchema,
  IsWebhookEnabledSchema,
  PreferredLanguagesSchema,
  PushNotificationsContentTypeSchema,
  ReminderStatusSchema,
  ServicesPreferencesModeSchema,
} from "../value-objects/profile/profile.value-object.js";

export const ServicePreferencesSettingsSchema = z.object({
  mode: ServicesPreferencesModeSchema,
});
export type ServicePreferencesSettingsSchema = z.infer<
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

export const ExtendedProfileSchema = ExtendedProfileBase.extend({
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
export type ExtendedProfileSchema = z.infer<typeof ExtendedProfileSchema>;

const NewProfileBase = z.object({
  is_email_validated: IsEmailValidatedSchema,
});

export const NewProfile = NewProfileBase.extend({
  email: EmailAddressSchema.optional(),
  is_test_profile: IsTestProfileSchema.optional(),
});
export type NewProfile = z.infer<typeof NewProfile>;
