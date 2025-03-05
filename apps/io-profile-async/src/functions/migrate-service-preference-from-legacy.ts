import * as ROA from "fp-ts/lib/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import * as t from "io-ts";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";

import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  NewServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";

import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { QueuePermanentError } from "../utils/queue-utils";
import {
  ServicePreferencesRepository,
  ServicePreferencesRepositoryDependencies,
  Tracker,
  TrackerRepositoryDependency
} from "../repositories";

// Note: this type is shared with io-profile (UpdateProfile)
export const MigrateServicesPreferencesQueueMessage = t.type({
  newProfile: RetrievedProfile,
  oldProfile: RetrievedProfile
});
export type MigrateServicesPreferencesQueueMessage = t.TypeOf<
  typeof MigrateServicesPreferencesQueueMessage
>;

export const createServicePreference = (
  serviceId: ServiceId,
  blockedChannels: ReadonlyArray<BlockedInboxOrChannelEnum>,
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
): NewServicePreference => ({
  accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN,
  fiscalCode,
  id: makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
  isEmailEnabled: !blockedChannels.includes(BlockedInboxOrChannelEnum.EMAIL),
  isInboxEnabled: !blockedChannels.includes(BlockedInboxOrChannelEnum.INBOX),
  isWebhookEnabled: !blockedChannels.includes(
    BlockedInboxOrChannelEnum.WEBHOOK
  ),
  kind: "INewServicePreference",
  serviceId,
  settingsVersion: version
});

export const blockedsToServicesPreferences = (
  blocked:
    | {
        [x: string]: ReadonlyArray<BlockedInboxOrChannelEnum>;
      }
    | undefined,
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
): NewServicePreference[] =>
  pipe(
    O.fromNullable(blocked),
    O.map(b =>
      Object.entries(b)
        .filter((_): _ is [
          ServiceId,
          ReadonlyArray<BlockedInboxOrChannelEnum>
        ] => ServiceId.is(_[0]))
        .map(([serviceId, blockedInboxOrChannelsForService]) =>
          createServicePreference(
            serviceId,
            blockedInboxOrChannelsForService,
            fiscalCode,
            version
          )
        )
    ),
    O.getOrElseW(() => [])
  );

export type HandlerDependencies = {
  servicePreferencesRepository: ServicePreferencesRepository;
  tracker: Tracker;
} & ServicePreferencesRepositoryDependencies & // Subdependencies
  TrackerRepositoryDependency;

export const makeHandler: H.Handler<
  MigrateServicesPreferencesQueueMessage,
  void,
  HandlerDependencies
> = H.of(migrateInput => deps =>
  pipe(
    migrateInput,
    TE.of,
    TE.chainFirstTaskK(input =>
      deps.tracker.traceMigratingServicePreferences(
        input.oldProfile,
        input.newProfile,
        "DOING"
      )(deps)
    ),
    TE.filterOrElse(
      input =>
        NonNegativeInteger.is(
          input.newProfile.servicePreferencesSettings.version
        ),
      () =>
        new QueuePermanentError(
          "Can not migrate to negative services preferences version."
        )
    ),
    TE.chain(input =>
      pipe(
        blockedsToServicesPreferences(
          input.oldProfile.blockedInboxOrChannels,
          input.newProfile.fiscalCode,
          input.newProfile.servicePreferencesSettings
            .version as NonNegativeInteger // cast required: ts do not identify filterOrElse as a guard))
        ),
        ROA.map(newPreference =>
          deps.servicePreferencesRepository.createServicePreference(
            newPreference
          )(deps)
        ),
        ROA.sequence(TE.ApplicativeSeq)
      )
    ),
    TE.chainTaskK(_ =>
      deps.tracker.traceMigratingServicePreferences(
        migrateInput.oldProfile,
        migrateInput.newProfile,
        "DONE"
      )(deps)
    ),
    TE.orElseW(error => {
      if (error instanceof QueuePermanentError) {
        return TE.fromTask(
          deps.tracker.trackEvent(
            "io.citizen-auth.prof-async.migrate-service-preference-from-legacy.error.permanent" as NonEmptyString,
            error.message as NonEmptyString
          )(deps)
        );
      } else {
        return TE.left(error);
      }
    })
  )
);

export const MigrateServicePreferenceFromLegacyFunction = azureFunction(
  makeHandler
);
