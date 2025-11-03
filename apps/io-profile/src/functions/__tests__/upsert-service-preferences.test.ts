/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

import { Context } from "@azure/functions";
import { ActivationStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ActivationStatus";
import { ServiceScopeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceScope";
import { SpecialServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/SpecialServiceCategory";
import { Activation } from "@pagopa/io-functions-commons/dist/src/models/activation";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { AccessReadMessageStatusEnum } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { context } from "../__mocks__/durable-functions";
import {
  aFiscalCode,
  aRetrievedProfileWithEmail,
  autoProfileServicePreferencesSettings,
  legacyProfileServicePreferencesSettings,
} from "../__mocks__/mocks";
import {
  aNewServicePreference,
  aRetrievedService,
  aRetrievedServicePreference,
  aServiceId,
  aServicePreference,
} from "../__mocks__/mocks.service_preference";
import * as subscriptionFeedHandler from "../update-subscriptions-feed-activity";
import { GetUpsertServicePreferencesHandler } from "../upsert-service-preferences";
import {
  DEFAULT_REDIS_SERVICE_CACHE_TTL,
  mockGet,
  mockRedisClientTask,
  mockSetEx,
} from "../__mocks__/redis.mock";

const makeContext = () => ({ ...context, bindings: {} }) as unknown as Context;

const updateSubscriptionFeedMock = vi
  .fn()
  .mockImplementation(() => Promise.resolve("SUCCESS"));
vi.spyOn(subscriptionFeedHandler, "updateSubscriptionFeed").mockImplementation(
  updateSubscriptionFeedMock,
);

const telemetryClientMock = {
  trackEvent: vi.fn(),
};

const aRetrievedProfileInValidState = {
  ...aRetrievedProfileWithEmail,
  servicePreferencesSettings: autoProfileServicePreferencesSettings,
};

const profileFindLastVersionByModelIdMock = vi.fn(() =>
  TE.of<CosmosErrors, O.Option<RetrievedProfile>>(
    O.some(aRetrievedProfileInValidState),
  ),
);
const serviceFindLastVersionByModelIdMock = vi.fn((_) =>
  TE.of<CosmosErrors, O.Option<RetrievedService>>(O.some(aRetrievedService)),
);
const servicePreferenceFindModelMock = vi
  .fn()
  .mockImplementation((_) => TE.of(O.some(aRetrievedServicePreference)));
const servicePreferenceUpsertModelMock = vi
  .fn()
  .mockImplementation((_) => TE.of(_));

const profileModelMock = {
  findLastVersionByModelId: profileFindLastVersionByModelIdMock,
};
const serviceModelMock = {
  findLastVersionByModelId: serviceFindLastVersionByModelIdMock,
};
const servicePreferenceModelMock = {
  find: servicePreferenceFindModelMock,
  upsert: servicePreferenceUpsertModelMock,
};

const aDisabledInboxServicePreference = {
  ...aServicePreference,
  is_inbox_enabled: false,
  can_access_message_read_status: false,
};

const mockActivationModel = {
  findLastVersionByModelId: vi.fn(),
};
const anActiveActivation: Activation = {
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  status: ActivationStatusEnum.ACTIVE,
};

const aSpecialRetrievedService: RetrievedService = {
  ...aRetrievedService,
  serviceMetadata: {
    scope: ServiceScopeEnum.LOCAL,
    category: SpecialServiceCategoryEnum.SPECIAL,
  },
};

const upsertServicePreferencesHandler = GetUpsertServicePreferencesHandler(
  telemetryClientMock as any,
  profileModelMock as any,
  serviceModelMock as any,
  servicePreferenceModelMock as any,
  mockActivationModel as any,
  {} as any,
  "SubFeedTableName" as NonEmptyString,
  mockRedisClientTask,
  DEFAULT_REDIS_SERVICE_CACHE_TTL,
);

describe("UpsertServicePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return Success if user service preferences has been upserted", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });

  it("should return Success if user service preferences has been upserted without updatingSubscriptionFeed if isInboxEnabled has not been changed", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).not.toHaveBeenCalled();
  });

  it("should return Success if user service preferences has been upserted with subscriptionFeed UNSUBSCRIBED in case isInboxEnabled has been changed to false", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aDisabledInboxServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aDisabledInboxServicePreference,
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "UNSUBSCRIBED",
        subscriptionKind: "SERVICE",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("should return Success if user service preferences has been upserted with subscriptionFeed SUBSCRIBED in case isInboxEnabled has been changed to true", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.of(O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })),
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "SUBSCRIBED",
        subscriptionKind: "SERVICE",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("should return Success with upserted user service preferences even if subscription feed update throw an error", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.of(O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })),
    );
    updateSubscriptionFeedMock.mockImplementationOnce(() =>
      Promise.reject(new Error("Subscription Feed Error")),
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "SUBSCRIBED",
        subscriptionKind: "SERVICE",
      }),
      expect.anything(),
      expect.anything(),
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalled();
  });

  it("should return Success with upserted user service preferences even if subscription feed update returns FAILURE", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.of(O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })),
    );
    updateSubscriptionFeedMock.mockImplementationOnce(() =>
      Promise.resolve("FAILURE"),
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "SUBSCRIBED",
        subscriptionKind: "SERVICE",
      }),
      expect.anything(),
      expect.anything(),
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalled();
  });

  it.each`
    scenario                                                                                        | serviceResult                              | servicePreference                                                                            | servicePreferencesResult                      | activationResult                                                                   | is_inbox_enabled | can_access_message_read_status
    ${"inbox enabled if exists an ACTIVE activation with undefined can_access_message_read_status"} | ${TE.of(O.some(aSpecialRetrievedService))} | ${{ ...aServicePreference, can_access_message_read_status: undefined }}                      | ${TE.of(O.some(aRetrievedServicePreference))} | ${TE.of(O.some(anActiveActivation))}                                               | ${true}          | ${true}
    ${"inbox enabled if exists an ACTIVE activation with false can_access_message_read_status"}     | ${TE.of(O.some(aSpecialRetrievedService))} | ${{ ...aServicePreference, can_access_message_read_status: false }}                          | ${TE.of(O.some(aRetrievedServicePreference))} | ${TE.of(O.some(anActiveActivation))}                                               | ${true}          | ${false}
    ${"inbox enabled if exists an ACTIVE activation with true can_access_message_read_status"}      | ${TE.of(O.some(aSpecialRetrievedService))} | ${aServicePreference}                                                                        | ${TE.of(O.some(aRetrievedServicePreference))} | ${TE.of(O.some(anActiveActivation))}                                               | ${true}          | ${true}
    ${"inbox disabled if don't exists an activation"}                                               | ${TE.of(O.some(aSpecialRetrievedService))} | ${{ ...aServicePreference, is_inbox_enabled: false, can_access_message_read_status: false }} | ${TE.of(O.some(aRetrievedServicePreference))} | ${TE.of(O.none)}                                                                   | ${false}         | ${false}
    ${"inbox disabled if exists a PENDING activation"}                                              | ${TE.of(O.some(aSpecialRetrievedService))} | ${{ ...aServicePreference, is_inbox_enabled: false, can_access_message_read_status: false }} | ${TE.of(O.some(aRetrievedServicePreference))} | ${TE.of(O.some({ ...anActiveActivation, status: ActivationStatusEnum.PENDING }))}  | ${false}         | ${false}
    ${"inbox disabled if exists a INACTIVE activation"}                                             | ${TE.of(O.some(aSpecialRetrievedService))} | ${{ ...aServicePreference, is_inbox_enabled: false, can_access_message_read_status: false }} | ${TE.of(O.some(aRetrievedServicePreference))} | ${TE.of(O.some({ ...anActiveActivation, status: ActivationStatusEnum.INACTIVE }))} | ${false}         | ${false}
  `(
    "should return $scenario",
    async ({
      serviceResult,
      servicePreference,
      servicePreferencesResult,
      activationResult,
      is_inbox_enabled,
      can_access_message_read_status,
    }) => {
      servicePreferenceFindModelMock.mockImplementationOnce(
        () => servicePreferencesResult,
      );
      serviceModelMock.findLastVersionByModelId.mockImplementationOnce(
        () => serviceResult,
      );
      mockActivationModel.findLastVersionByModelId.mockImplementationOnce(
        () => activationResult,
      );
      const response = await upsertServicePreferencesHandler(
        makeContext(),
        aFiscalCode,
        aServiceId,
        servicePreference,
      );

      expect(response).toMatchObject({
        kind: "IResponseSuccessJson",
        value: {
          ...aServicePreference,
          is_inbox_enabled,
          can_access_message_read_status,
        },
      });

      expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
      expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
      expect(servicePreferenceModelMock.find).toHaveBeenCalled();
      expect(servicePreferenceModelMock.upsert).toHaveBeenCalledWith({
        ...aNewServicePreference,
        isInboxEnabled: is_inbox_enabled,
        accessReadMessageStatus:
          servicePreference.can_access_message_read_status === undefined
            ? AccessReadMessageStatusEnum.UNKNOWN
            : can_access_message_read_status
              ? AccessReadMessageStatusEnum.ALLOW
              : AccessReadMessageStatusEnum.DENY,
      });
      // Subscription feed never be update for SPECIAL servies preferences changes.
      expect(updateSubscriptionFeedMock).not.toBeCalled();
      expect(telemetryClientMock.trackEvent).not.toHaveBeenCalled();
    },
  );

  it("should return Success with service cache HIT", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(aRetrievedService));

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(mockSetEx).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
    );
    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).not.toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });

  it("should return Success with service cache MISS", async () => {
    mockGet.mockResolvedValueOnce(null);

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(mockGet).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
    );
    expect(mockSetEx).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
      60,
      JSON.stringify(aRetrievedService),
    );
    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });

  // ---------------------------------------------
  // Errors
  // ---------------------------------------------
  it("should return IResponseErrorValidation when is_inbox_enabled=false and can_access_message_read_status=true", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      { ...aServicePreference, is_inbox_enabled: false },
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorValidation",
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorNotFound if no profile is found in db", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.of(O.none),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorNotFound",
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).not.toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorNotFound if no service is found in db", async () => {
    serviceFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.of(O.none),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorNotFound",
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if profile model raise an error", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left({} as CosmosErrors),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if service model raise an error", async () => {
    serviceFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left({} as CosmosErrors),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if serviceSettings model find raise an error", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.left({} as CosmosErrors),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if serviceSettings model upsert raise an error", async () => {
    servicePreferenceUpsertModelMock.mockImplementationOnce(() =>
      TE.left({} as CosmosErrors),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });

    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if activation model find raise an error for special services", async () => {
    serviceModelMock.findLastVersionByModelId.mockImplementationOnce(() =>
      TE.of(O.some(aSpecialRetrievedService)),
    );
    mockActivationModel.findLastVersionByModelId.mockImplementationOnce(() =>
      TE.left({} as CosmosErrors),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });

    expect(servicePreferenceModelMock.find).toBeCalledTimes(1);
    expect(mockActivationModel.findLastVersionByModelId).toBeCalledTimes(1);
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if profile is in LEGACY mode", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.of(
        O.some({
          ...aRetrievedProfileInValidState,
          servicePreferencesSettings: legacyProfileServicePreferencesSettings,
        }),
      ),
    );

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict",
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if service preference has a different version from profile's one", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      {
        ...aServicePreference,
        settings_version: (Number(aServicePreference) +
          1) as NonNegativeInteger,
      },
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict",
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if is_inbox_enabled value missmatch the activation for a special service", async () => {
    serviceModelMock.findLastVersionByModelId.mockImplementationOnce(() =>
      TE.of(O.some(aSpecialRetrievedService)),
    );
    mockActivationModel.findLastVersionByModelId.mockImplementationOnce(() =>
      TE.of(O.some(anActiveActivation)),
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      {
        ...aServicePreference,
        is_inbox_enabled: false,
      },
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict",
    });

    expect(serviceModelMock.findLastVersionByModelId).toBeCalledTimes(1);
    expect(mockActivationModel.findLastVersionByModelId).toBeCalledTimes(1);
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it.each`
    scenario                                                  | servicePreference     | maybeExistingServicePreference
    ${"enabled preference and no previous preferences"}       | ${aServicePreference} | ${O.none}
    ${"enabled preference and disabled previous preferences"} | ${aServicePreference} | ${O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })}
  `(
    "should emit event subscription event on $scenario",
    async ({ servicePreference, maybeExistingServicePreference }) => {
      servicePreferenceFindModelMock.mockImplementationOnce(() =>
        TE.of(maybeExistingServicePreference),
      );

      const ctx = makeContext();

      const _ = await upsertServicePreferencesHandler(
        ctx,
        aFiscalCode,
        aServiceId,
        servicePreference,
      );

      // we don't car of the event format, we just care relevant informations are there
      expect(ctx.bindings.apievents).toEqual(
        expect.stringContaining(aFiscalCode),
      );
      expect(ctx.bindings.apievents).toEqual(
        expect.stringContaining(aServiceId),
      );
    },
  );

  it.each`
    scenario                                                   | servicePreference                  | maybeExistingServicePreference
    ${"disabled preference and no previous preferences"}       | ${aDisabledInboxServicePreference} | ${O.none}
    ${"disabled preference and disabled previous preferences"} | ${aDisabledInboxServicePreference} | ${O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })}
    ${"enabled preference and enabled previous preferences"}   | ${aServicePreference}              | ${O.some({ ...aRetrievedServicePreference, isInboxEnabled: true })}
  `(
    "should NOT emit event subscription event on $scenario",
    async ({ servicePreference, maybeExistingServicePreference }) => {
      servicePreferenceFindModelMock.mockImplementationOnce(() =>
        TE.of(maybeExistingServicePreference),
      );

      const ctx = makeContext();

      const _ = await upsertServicePreferencesHandler(
        ctx,
        aFiscalCode,
        aServiceId,
        servicePreference,
      );

      // we don't car of the event format, we just care relevant informations are there
      expect(ctx.bindings.apievents).toBe(undefined);
    },
  );

  it("should return Success with service cache MISS and SETEX failure", async () => {
    const anError = Error("anError");
    mockGet.mockResolvedValueOnce(null);
    mockSetEx.mockRejectedValueOnce(anError);

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(mockGet).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
    );
    expect(mockSetEx).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
      60,
      JSON.stringify(aRetrievedService),
    );
    expect(mockSetEx.mock.settledResults).toEqual([
      {
        type: "rejected",
        value: anError,
      },
    ]);
    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });

  it("should return Success with service cache GET failure", async () => {
    const anError = Error("anError");
    mockGet.mockRejectedValueOnce(anError);

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(mockGet).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
    );
    expect(mockSetEx).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
      60,
      JSON.stringify(aRetrievedService),
    );
    expect(mockGet.mock.settledResults).toEqual([
      {
        type: "rejected",
        value: anError,
      },
    ]);
    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });

  it("should return Success with service cache unavailable", async () => {
    const anError = Error("anError");

    const response = await GetUpsertServicePreferencesHandler(
      telemetryClientMock as any,
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      mockActivationModel as any,
      {} as any,
      "SubFeedTableName" as NonEmptyString,
      // cache unavailable
      TE.left(anError),
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    )(makeContext(), aFiscalCode, aServiceId, aServicePreference);

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference,
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSetEx).not.toHaveBeenCalled();
    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });
});
