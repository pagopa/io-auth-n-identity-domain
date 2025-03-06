import { beforeEach, describe, expect, it, vi } from "vitest";

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { TelemetryClient } from "applicationinsights";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import {
  makeHandler,
  MigrateServicesPreferencesQueueMessage
} from "../migrate-service-preference-from-legacy";
import { mockQueueHandlerInputMocks } from "../__mocks__/handler.mock";
import {
  traceMigratingServicePreferencesMock,
  trackerMock,
  trackEventMock
} from "../__mocks__/tracker.mock";
import {
  createServicePreferenceMock,
  servicePreferencesRepositoryMock
} from "../__mocks__/service-preferences-repository.mock";

const baseProfile = {
  email: "info@agid.gov.it" as EmailString,
  fiscalCode: "QHBYBB58M51L494Q" as FiscalCode,
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: false,
  isTestProfile: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile" as const,
  id: "QHBYBB58M51L494Q-0000000000000000" as NonEmptyString,
  version: 0 as NonNegativeInteger,
  _rid: "tbAzALPWVGYLAAAAAAAAAA==",
  _self: "dbs/tbAzAA==/colls/tbAzALPWVGY=/docs/tbAzALPWVGYLAAAAAAAAAA==/",
  _etag: '"3500cd83-0000-0d00-0000-60e305f90000"',
  _ts: 1625490937
};

const legacyProfile: RetrievedProfile = {
  ...baseProfile,
  servicePreferencesSettings: {
    mode: ServicesPreferencesModeEnum.LEGACY,
    version: -1
  }
};

const legacyProfileWithBlockedServices: RetrievedProfile = {
  ...legacyProfile,
  blockedInboxOrChannels: {
    MyServiceId: [
      BlockedInboxOrChannelEnum.INBOX,
      BlockedInboxOrChannelEnum.EMAIL
    ],
    MyServiceId2: [BlockedInboxOrChannelEnum.WEBHOOK]
  }
};

const autoProfile: RetrievedProfile = {
  ...baseProfile,
  servicePreferencesSettings: {
    mode: ServicesPreferencesModeEnum.AUTO,
    version: 0 as NonNegativeInteger
  }
};

// --------------
// Mocks
// --------------

const mockedDependencies = {
  ...mockQueueHandlerInputMocks(MigrateServicesPreferencesQueueMessage, {
    oldProfile: legacyProfile,
    newProfile: autoProfile
  }),
  tracker: trackerMock,
  servicePreferencesRepository: servicePreferencesRepositoryMock,
  // Subdependencies, unused in this tests
  servicePreferenceModel: (null as unknown) as ServicesPreferencesModel,
  telemetryClient: (null as unknown) as TelemetryClient
};

// --------------
// Mocks
// --------------

// eslint-disable-next-line max-lines-per-function
describe("MigrateServicePreferenceFromLegacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GIVEN a message with legacy oldProfile containing blocked channel, WHEN the queue handler is called, THEN must complete creating the new service preferences", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfileWithBlockedServices
    };
    const handler = makeHandler({
      ...mockedDependencies,
      input: legacyToAutoRawInput
    });
    const result = await handler();

    expect(result).toEqual(E.of(void 0));

    expect(createServicePreferenceMock).toHaveBeenCalledTimes(2);
    expect(createServicePreferenceMock).toHaveBeenNthCalledWith(1, {
      accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN,
      fiscalCode: autoProfile.fiscalCode,
      id: makeServicesPreferencesDocumentId(
        autoProfile.fiscalCode as FiscalCode,
        "MyServiceId" as ServiceId,
        0 as NonNegativeInteger
      ),
      serviceId: "MyServiceId",
      settingsVersion: 0,
      kind: "INewServicePreference",
      isEmailEnabled: false,
      isInboxEnabled: false,
      isWebhookEnabled: true
    } as NewServicePreference);
    expect(createServicePreferenceMock).toHaveBeenNthCalledWith(2, {
      accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN,
      fiscalCode: autoProfile.fiscalCode,
      id: makeServicesPreferencesDocumentId(
        autoProfile.fiscalCode as FiscalCode,
        "MyServiceId2" as ServiceId,
        0 as NonNegativeInteger
      ),
      serviceId: "MyServiceId2",
      settingsVersion: 0,
      kind: "INewServicePreference",
      isEmailEnabled: true,
      isInboxEnabled: true,
      isWebhookEnabled: false
    } as NewServicePreference);

    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledTimes(2);
    expect(traceMigratingServicePreferencesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        servicePreferencesSettings: legacyProfile.servicePreferencesSettings
      }),
      expect.objectContaining({
        servicePreferencesSettings: autoProfile.servicePreferencesSettings
      }),
      "DOING"
    );
    expect(traceMigratingServicePreferencesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        servicePreferencesSettings: legacyProfile.servicePreferencesSettings
      }),
      expect.objectContaining({
        servicePreferencesSettings: autoProfile.servicePreferencesSettings
      }),
      "DONE"
    );
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("GIVEN a message with legacy oldProfile not containing blocked channel, WHEN the queue handler is called, THEN must complete without creating any service preference", async () => {
    const handler = makeHandler(mockedDependencies);
    const result = await handler();

    expect(result).toEqual(E.of(void 0));

    expect(createServicePreferenceMock).not.toHaveBeenCalled();
    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledTimes(2);
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("GIVEN a message with legacy oldProfile containing blocked channels, WHEN the queue handler is called with ServicesPreferences already created, THEN must continue with no errors", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfileWithBlockedServices
    };
    const handler = makeHandler({
      ...mockedDependencies,
      input: legacyToAutoRawInput
    });

    createServicePreferenceMock.mockReturnValueOnce(() => TE.of(false));

    const result = await handler();

    expect(result).toEqual(E.of(void 0));

    expect(createServicePreferenceMock).toHaveBeenCalledTimes(2);
    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledTimes(2);
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("GIVEN a valid message, WHEN the queue handler is called with cosmosdb not working, THEN must return an error", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfileWithBlockedServices
    };
    const handler = makeHandler({
      ...mockedDependencies,
      input: legacyToAutoRawInput
    });

    createServicePreferenceMock.mockReturnValueOnce(() =>
      TE.left(Error("CosmosError"))
    );

    const result = await handler();

    expect(result).toEqual(E.left(Error("CosmosError")));

    // It does not stop if an error occurred
    expect(createServicePreferenceMock).toHaveBeenCalledTimes(2);

    // It does not track "DONE" event
    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledTimes(1);
    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "DOING"
    );
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("GIVEN a new profile with LEGACY service preference settings, THEN must trace a permanent error and continue", async () => {
    const legacyToAutoRawInput = {
      newProfile: legacyProfileWithBlockedServices,
      oldProfile: legacyProfileWithBlockedServices
    };
    const handler = makeHandler({
      ...mockedDependencies,
      input: legacyToAutoRawInput
    });

    const result = await handler();

    expect(result).toEqual(E.of(void 0));

    // It does not stop if an error occurred
    expect(createServicePreferenceMock).not.toHaveBeenCalled();

    // It does not track "DONE" event
    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledTimes(1);
    expect(traceMigratingServicePreferencesMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "DOING"
    );
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      "io.citizen-auth.prof-async.migrate-service-preference-from-legacy.error.permanent",
      "Can not migrate to negative services preferences version."
    );
  });
});
