import * as RT from "fp-ts/ReaderTask";
import * as T from "fp-ts/Task";
import { NonEmptyString } from "io-ts-types";

import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";

import { initTelemetryClient } from "../utils/appinsights";

export type Dependencies = {
  telemetryClient: ReturnType<typeof initTelemetryClient>;
};

/**
 * Trace an event when a user has previous preferences to migrate
 */
const traceMigratingServicePreferences: (
  oldProfile: RetrievedProfile,
  newProfile: RetrievedProfile,
  action: "REQUESTING" | "DOING" | "DONE"
) => RT.ReaderTask<Dependencies, void> = (oldProfile, newProfile, action) => ({
  telemetryClient
}) =>
  T.of(
    telemetryClient?.trackEvent({
      name: "api.profile.migrate-legacy-preferences",
      properties: {
        action,
        oldPreferences: oldProfile.blockedInboxOrChannels,
        oldPreferencesCount: Object.keys(
          oldProfile.blockedInboxOrChannels || {}
        ).length,
        profileVersion: newProfile.version,
        servicePreferencesMode: newProfile.servicePreferencesSettings.mode,
        servicePreferencesVersion:
          newProfile.servicePreferencesSettings.version,
        userId: "TODO" //toHash(newProfile.fiscalCode)
      },
      tagOverrides: { samplingEnabled: "false" }
    })
  );

/**
 * Trace an event when a user has previous preferences to migrate
 */
const trackEvent: (
  name: NonEmptyString,
  message: NonEmptyString,
  isSamplingEnabled?: boolean
) => RT.ReaderTask<Dependencies, void> = (
  name,
  message,
  isSamplingEnabled = false
) => ({ telemetryClient }) =>
  T.of(
    telemetryClient?.trackEvent({
      name,
      properties: {
        message
      },
      tagOverrides: { samplingEnabled: String(isSamplingEnabled) }
    })
  );

export type Tracker = typeof tracker;
export const tracker = { trackEvent, traceMigratingServicePreferences };
