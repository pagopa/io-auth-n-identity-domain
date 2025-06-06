import * as t from "io-ts";

import * as RA from "fp-ts/lib/ReadonlyArray";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import * as df from "durable-functions";
import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";

import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";

import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { diffBlockedServices } from "../utils/profiles";
import {
  makeProfileCompletedEvent,
  makeServicePreferencesChangedEvent,
} from "../utils/emitted-events";
import { ActivityInput as SendWelcomeMessageActivityInput } from "./send-welcome-messages-activity";
import { Input as UpdateServiceSubscriptionFeedActivityInput } from "./update-subscriptions-feed-activity";
import {
  OrchestratorInput as EmailValidationWithTemplateProcessOrchestratorInput,
  OrchestratorResult as EmailValidationWithTemplateProcessOrchestratorResult,
} from "./email-validation-orchestrator";
import {
  ActivityResult,
  ActivityResultSuccess,
} from "./get-services-preferences-activity";

/**
 * Carries information about created or updated profile.
 *
 * When oldProfile is defined, the profile has been updated, or it has been
 * created otherwise.
 */
export const OrchestratorInput = t.intersection([
  t.type({
    newProfile: RetrievedProfile,
    updatedAt: UTCISODateFromString,
  }),
  t.partial({
    name: t.string,
    oldProfile: RetrievedProfile,
  }),
]);

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

// eslint-disable-next-line max-lines-per-function
export const getUpsertedProfileOrchestratorHandler = (params: {
  readonly sendCashbackMessage: boolean;
}) =>
  // eslint-disable-next-line max-lines-per-function, complexity, sonarjs/cognitive-complexity
  function* (context: IOrchestrationFunctionContext): Generator<unknown> {
    const logPrefix = `UpsertedProfileOrchestrator`;

    const retryOptions = new df.RetryOptions(5000, 10);
    // eslint-disable-next-line functional/immutable-data
    retryOptions.backoffCoefficient = 1.5;

    // Get and decode orchestrator input
    const input = context.df.getInput();
    const errorOrUpsertedProfileOrchestratorInput =
      OrchestratorInput.decode(input);

    if (E.isLeft(errorOrUpsertedProfileOrchestratorInput)) {
      context.log.error(
        `${logPrefix}|Error decoding input|ERROR=${readableReport(
          errorOrUpsertedProfileOrchestratorInput.left,
        )}`,
      );
      return false;
    }

    const upsertedProfileOrchestratorInput =
      errorOrUpsertedProfileOrchestratorInput.right;

    // Log the input
    context.log.verbose(
      `${logPrefix}|INPUT=${JSON.stringify(upsertedProfileOrchestratorInput)}`,
    );

    const { newProfile, oldProfile, updatedAt, name } =
      upsertedProfileOrchestratorInput;

    type ProfileOperation =
      | {
          readonly type: "UPDATED";
          readonly oldProfile: RetrievedProfile;
        }
      | {
          readonly type: "CREATED";
        };

    const profileOperation: ProfileOperation =
      oldProfile !== undefined
        ? { oldProfile, type: "UPDATED" }
        : { type: "CREATED" };

    // Check if the profile email is changed
    const isProfileEmailChanged =
      profileOperation.type === "UPDATED" &&
      newProfile.email !== profileOperation.oldProfile.email;
    // NOTE: if the following check is changed make sure to pass add the name field
    // to CreateProfile method which also calls this orchestrator
    if (isProfileEmailChanged && newProfile.email) {
      try {
        const { fiscalCode, email } = newProfile;

        // Start a sub-orchestrator that handles the email validation process.
        // From the caller point it is like a normal activity.
        context.log.verbose(
          `${logPrefix}|Email changed, starting the email validation process`,
        );
        const emailValidationProcessOrchestartorInput =
          EmailValidationWithTemplateProcessOrchestratorInput.encode({
            email,
            fiscalCode,
            name,
          });

        const emailValidationProcessOrchestartorResultJson =
          yield context.df.callSubOrchestratorWithRetry(
            "EmailValidationWithTemplateProcessOrchestrator",
            retryOptions,
            emailValidationProcessOrchestartorInput,
          );

        const errorOrEmailValidationProcessOrchestartorResult =
          EmailValidationWithTemplateProcessOrchestratorResult.decode(
            emailValidationProcessOrchestartorResultJson,
          );

        if (E.isLeft(errorOrEmailValidationProcessOrchestartorResult)) {
          context.log.error(
            `${logPrefix}|Error decoding sub-orchestrator result|ERROR=${readableReport(
              errorOrEmailValidationProcessOrchestartorResult.left,
            )}`,
          );
        } else {
          const emailValidationProcessOrchestartorResult =
            errorOrEmailValidationProcessOrchestartorResult.right;

          if (emailValidationProcessOrchestartorResult.kind === "FAILURE") {
            context.log.error(
              `${logPrefix}|Sub-orchestrator error|ERROR=${emailValidationProcessOrchestartorResult.reason}`,
            );
            return false;
          }

          context.log.verbose(
            `${logPrefix}|Email verification process completed sucessfully`,
          );
        }
      } catch (e) {
        context.log.error(
          `${logPrefix}|Email verification process max retry exceeded|ERROR=${e}`,
        );
      }
    }

    // Send welcome messages to the user
    const isInboxEnabled = newProfile.isInboxEnabled === true;
    const hasOldProfileWithInboxDisabled =
      profileOperation.type === "UPDATED" &&
      profileOperation.oldProfile.isInboxEnabled === false;

    const hasJustEnabledInbox =
      isInboxEnabled &&
      (profileOperation.type === "CREATED" || hasOldProfileWithInboxDisabled);

    context.log.verbose(
      `${logPrefix}|OPERATION=${profileOperation.type}|INBOX_ENABLED=${isInboxEnabled}|INBOX_JUST_ENABLED=${hasJustEnabledInbox}`,
    );

    if (hasJustEnabledInbox) {
      yield context.df.callActivityWithRetry(
        "SendWelcomeMessagesActivity",
        retryOptions,
        {
          messageKind: "WELCOME",
          profile: newProfile,
        } as SendWelcomeMessageActivityInput,
      );
      yield context.df.callActivityWithRetry(
        "SendWelcomeMessagesActivity",
        retryOptions,
        {
          messageKind: "HOWTO",
          profile: newProfile,
        } as SendWelcomeMessageActivityInput,
      );
      if (params.sendCashbackMessage) {
        yield context.df.callActivityWithRetry(
          "SendWelcomeMessagesActivity",
          retryOptions,
          {
            messageKind: "CASHBACK",
            profile: newProfile,
          } as SendWelcomeMessageActivityInput,
        );
      }
    }

    // Update subscriptions feed
    if (profileOperation.type === "CREATED") {
      // When a profile get created we add an entry to the profile subscriptions
      context.log.verbose(
        `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=SUBSCRIBED`,
      );
      yield context.df.callActivityWithRetry(
        "UpdateSubscriptionsFeedActivity",
        retryOptions,
        {
          fiscalCode: newProfile.fiscalCode,
          operation: "SUBSCRIBED",
          subscriptionKind: "PROFILE",
          updatedAt: updatedAt.getTime(),
          version: newProfile.version,
        } as UpdateServiceSubscriptionFeedActivityInput,
      );
    } else {
      const { newServicePreferencesMode, oldServicePreferenceMode } = {
        newServicePreferencesMode: newProfile.servicePreferencesSettings.mode,
        oldServicePreferenceMode:
          profileOperation.oldProfile.servicePreferencesSettings.mode,
      };

      if (newServicePreferencesMode === ServicesPreferencesModeEnum.LEGACY) {
        // When a LEGACY profile gets updates, we extract the services that have been
        // blocked and unblocked during this profile update.
        // Blocked services get mapped to unsubscribe events, while unblocked ones
        // get mapped to subscribe events.
        const { e1: unsubscribedServices, e2: subscribedServices } =
          diffBlockedServices(
            profileOperation.oldProfile.blockedInboxOrChannels,
            newProfile.blockedInboxOrChannels,
          );

        for (const s of subscribedServices) {
          context.log.verbose(
            `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=SUBSCRIBED|SERVICE_ID=${s}`,
          );
          yield context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            {
              fiscalCode: newProfile.fiscalCode,
              operation: "SUBSCRIBED",
              serviceId: s as ServiceId,
              subscriptionKind: "SERVICE",
              updatedAt: updatedAt.getTime(),
              version: newProfile.version,
            } as UpdateServiceSubscriptionFeedActivityInput,
          );
        }

        for (const s of unsubscribedServices) {
          context.log.verbose(
            `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=UNSUBSCRIBED|SERVICE_ID=${s}`,
          );
          yield context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            {
              fiscalCode: newProfile.fiscalCode,
              operation: "UNSUBSCRIBED",
              serviceId: s as ServiceId,
              subscriptionKind: "SERVICE",
              updatedAt: updatedAt.getTime(),
              version: newProfile.version,
            } as UpdateServiceSubscriptionFeedActivityInput,
          );
        }
        // we need to update Subscription Feed on Profile Upsert when:
        // Service Preference Mode has changed from oldProfile to newProfile in upsert operation
        // and mode transition causes an effective change (i.e when NOT going from LEGACY to AUTO)
      } else if (
        oldServicePreferenceMode !== newServicePreferencesMode &&
        (oldServicePreferenceMode !== ServicesPreferencesModeEnum.LEGACY ||
          newServicePreferencesMode !== ServicesPreferencesModeEnum.AUTO)
      ) {
        // | oldServicePreferenceMode | newServicePreferencesMode | Operation
        // -------------------------------------------------------------------------
        // | LEGACY                   | MANUAL                    | UNSUBSCRIBED
        // | AUTO                     | MANUAL                    | UNSUBSCRIBED
        // | MANUAL                   | AUTO                      | SUBSCRIBED
        // When a profile Service preference mode is upserted from AUTO or LEGACY to MANUAL
        // we must unsubscribe th entire profile, otherwise from MANUAL we can update mode only to AUTO
        // so we must subscribe the entire profile.
        const feedOperation =
          newServicePreferencesMode === ServicesPreferencesModeEnum.MANUAL
            ? "UNSUBSCRIBED"
            : "SUBSCRIBED";
        context.log.verbose(
          `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=${feedOperation}`,
        );

        // Only if previous mode is MANUAL or AUTO could exists services preferences.
        if (
          profileOperation.oldProfile.servicePreferencesSettings.mode !==
          ServicesPreferencesModeEnum.LEGACY
        ) {
          // Execute a new version of the orchestrator
          const activityResult = yield context.df.callActivityWithRetry(
            "GetServicesPreferencesActivity",
            retryOptions,
            {
              fiscalCode: profileOperation.oldProfile.fiscalCode,
              settingsVersion:
                profileOperation.oldProfile.servicePreferencesSettings.version,
            },
          );

          const maybeServicesPreferences = pipe(
            ActivityResult.decode(activityResult),
            E.mapLeft((_) => new Error(readableReport(_))),
            E.chain(
              E.fromPredicate(
                (_): _ is ActivityResultSuccess => _.kind === "SUCCESS",
                (_) => new Error(_.kind),
              ),
            ),
            E.fold(
              (err) => {
                // Invalid Activity input. The orchestration fail
                context.log.error(
                  `${logPrefix}|GetServicesPreferencesActivity|ERROR=${err.message}`,
                );
                throw err;
              },
              (_) => _.preferences,
            ),
          );
          yield context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            {
              fiscalCode: newProfile.fiscalCode,
              operation: feedOperation,
              previousPreferences: maybeServicesPreferences,
              subscriptionKind: "PROFILE",
              updatedAt: updatedAt.getTime(),
              version: newProfile.version,
            } as UpdateServiceSubscriptionFeedActivityInput,
          );
        } else {
          yield context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            {
              fiscalCode: newProfile.fiscalCode,
              operation: feedOperation,
              subscriptionKind: "PROFILE",
              updatedAt: updatedAt.getTime(),
              version: newProfile.version,
            } as UpdateServiceSubscriptionFeedActivityInput,
          );
        }
      }
    }

    const hasChangedPreferencesMode =
      newProfile.isInboxEnabled &&
      !hasJustEnabledInbox &&
      oldProfile &&
      newProfile.servicePreferencesSettings.mode !==
        oldProfile.servicePreferencesSettings.mode;

    const emittedEvents = pipe(
      [
        hasJustEnabledInbox
          ? O.some(
              makeProfileCompletedEvent(
                newProfile.fiscalCode,
                newProfile.servicePreferencesSettings.mode,
              ),
            )
          : O.none,
        hasChangedPreferencesMode
          ? O.some(
              makeServicePreferencesChangedEvent(
                newProfile.fiscalCode,
                newProfile.servicePreferencesSettings.mode,
                oldProfile.servicePreferencesSettings.mode,
              ),
            )
          : O.none,
      ],
      RA.compact,
    );

    if (emittedEvents.length) {
      yield context.df.Task.all(
        emittedEvents.map((e) =>
          context.df.callActivityWithRetry(
            "EmitEventActivity",
            retryOptions,
            e,
          ),
        ),
      );
    }

    return true;
  };
