import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import { ExtendedProfile } from "@pagopa/io-functions-app-sdk/ExtendedProfile";
import * as t from "io-ts";
import { formatDate } from "../utils/date";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { EmailAddress } from "../generated/backend/EmailAddress";
import { User } from "./user";

/**
 * Converts an existing ExtendedProfile to a Proxy profile.
 */
export const toInitializedProfile = (
  profile: ExtendedProfile,
  user: User,
): InitializedProfile => ({
  accepted_tos_version: profile.accepted_tos_version,
  blocked_inbox_or_channels: profile.blocked_inbox_or_channels,
  date_of_birth:
    user.date_of_birth !== undefined
      ? new Date(formatDate(user.date_of_birth))
      : undefined,
  email: profile.email,
  family_name: user.family_name,
  fiscal_code: user.fiscal_code,
  has_profile: true,
  is_email_already_taken: profile.is_email_already_taken,
  is_email_enabled: pipe(
    O.fromNullable(profile.is_email_enabled),
    O.getOrElseW(() => true),
  ),
  is_email_validated: profile.is_email_validated,
  is_inbox_enabled: profile.is_inbox_enabled,
  is_webhook_enabled: profile.is_webhook_enabled,
  last_app_version: profile.last_app_version,
  name: user.name,
  preferred_languages: profile.preferred_languages,
  push_notifications_content_type: profile.push_notifications_content_type,
  reminder_status: profile.reminder_status,
  service_preferences_settings: profile.service_preferences_settings,
  spid_email: user.spid_email,
  version: profile.version,
});

// define a type that represents a Profile with a non optional email address
const ProfileWithEmail = t.intersection([
  t.interface({
    email: EmailAddress,
  }),
  InitializedProfile,
]);

type ProfileWithEmail = t.TypeOf<typeof ProfileWithEmail>;

// define a branded type that ensure we have the email in the profile and
// that it is not undefined
export interface IProfileWithEmailValidatedTag {
  readonly HasValidEmailAddress: unique symbol;
}

export const ProfileWithEmailValidated = t.brand(
  ProfileWithEmail,
  (p): p is t.Branded<ProfileWithEmail, IProfileWithEmailValidatedTag> =>
    !!(p.email && p.is_email_validated),
  "HasValidEmailAddress",
);
