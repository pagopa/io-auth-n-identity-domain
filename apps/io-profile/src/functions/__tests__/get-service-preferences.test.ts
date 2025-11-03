/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
import * as O from "fp-ts/lib/Option";
import { none, some } from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActivationStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ActivationStatus";
import { ServiceScopeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceScope";
import { SpecialServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/SpecialServiceCategory";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { left } from "fp-ts/lib/Either";
import {
  aFiscalCode,
  aRetrievedProfile,
  aRetrievedProfileWithEmail,
  autoProfileServicePreferencesSettings,
  legacyProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings,
} from "../__mocks__/mocks";
import {
  anActiveActivation,
  aRetrievedService,
  aRetrievedServicePreference,
  aServiceId,
  aServicePreferenceVersion,
} from "../__mocks__/mocks.service_preference";
import { GetServicePreferencesHandler } from "../get-service-preferences";
import {
  DEFAULT_REDIS_SERVICE_CACHE_TTL,
  mockGet,
  mockRedisClientTask,
  mockSetEx,
} from "../__mocks__/redis.mock";

const aRetrievedProfileInValidState = {
  ...aRetrievedProfileWithEmail,
  servicePreferencesSettings: autoProfileServicePreferencesSettings,
};

const aRetrievedSpecialService: RetrievedService = {
  ...aRetrievedService,
  serviceMetadata: {
    scope: ServiceScopeEnum.LOCAL,
    category: SpecialServiceCategoryEnum.SPECIAL,
  },
};

const mockServiceFindLastVersionByModelId = vi.fn((_) =>
  TE.of(O.some(aRetrievedService)),
);
const serviceModelMock = {
  findLastVersionByModelId: mockServiceFindLastVersionByModelId,
};

describe("GetServicePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should return existing service preference for user", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: aServicePreferenceVersion,
      },
    });
  });

  it("should return default ENABLED preferences if no service preference is found for user and mode is AUTO", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(none)),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: 0,
      },
    });
  });

  it("should return default DISABLED preferences if no service preference is found for user and mode is MANUAL", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(
          some({
            ...aRetrievedProfileInValidState,
            servicePreferencesSettings: manualProfileServicePreferencesSettings,
          }),
        ),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(none)),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: false,
        is_inbox_enabled: false,
        is_webhook_enabled: false,
        settings_version: 1,
      },
    });
  });

  it("should NOT retrieve service from DB on cache HIT", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(aRetrievedService));

    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

    expect(mockSetEx).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
    );
    expect(mockServiceFindLastVersionByModelId).not.toHaveBeenCalled();

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: aServicePreferenceVersion,
      },
    });
  });

  it("should retrieve service from DB on cache MISS and call SETEX", async () => {
    mockGet.mockResolvedValueOnce(null);

    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

    expect(mockGet).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
    );
    expect(mockSetEx).toHaveBeenCalledExactlyOnceWith(
      `FNPROFILE-SERVICE-${aServiceId}`,
      60,
      JSON.stringify(aRetrievedService),
    );
    expect(mockServiceFindLastVersionByModelId).toHaveBeenCalledOnce();

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: aServicePreferenceVersion,
      },
    });
  });

  // ---------------------------------------------
  // Errors
  // ---------------------------------------------

  it("should return IResponseErrorNotFound if no profile is found in db", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() => TE.of(none)),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorNotFound",
    });

    expect(serviceModelMock.findLastVersionByModelId).not.toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if profile model raise an error", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.fromEither(left({} as CosmosErrors)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.fromEither(left({} as CosmosErrors))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });

    expect(servicePreferenceModelMock.find).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if profile is in LEGACY mode", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: legacyProfileServicePreferencesSettings,
          }),
        ),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.fromEither(left({} as CosmosErrors))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict",
    });

    expect(servicePreferenceModelMock.find).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if service preference model raise an error", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.fromEither(left({} as CosmosErrors))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });
  });
  it.each`
    scenario                                            | profileResult                                 | serviceResult                              | servicePreferencesResult                    | activationResult                                                                   | is_inbox_enabled
    ${"inbox enabled if exists an ACTIVE activation"}   | ${TE.of(some(aRetrievedProfileInValidState))} | ${TE.of(O.some(aRetrievedSpecialService))} | ${TE.of(some(aRetrievedServicePreference))} | ${TE.of(O.some(anActiveActivation))}                                               | ${true}
    ${"inbox disabled if don't exists an activation"}   | ${TE.of(some(aRetrievedProfileInValidState))} | ${TE.of(O.some(aRetrievedSpecialService))} | ${TE.of(some(aRetrievedServicePreference))} | ${TE.of(O.none)}                                                                   | ${false}
    ${"inbox disabled if exists a PENDING activation"}  | ${TE.of(some(aRetrievedProfileInValidState))} | ${TE.of(O.some(aRetrievedSpecialService))} | ${TE.of(some(aRetrievedServicePreference))} | ${TE.of(O.some({ ...anActiveActivation, status: ActivationStatusEnum.PENDING }))}  | ${false}
    ${"inbox disabled if exists a INACTIVE activation"} | ${TE.of(some(aRetrievedProfileInValidState))} | ${TE.of(O.some(aRetrievedSpecialService))} | ${TE.of(some(aRetrievedServicePreference))} | ${TE.of(O.some({ ...anActiveActivation, status: ActivationStatusEnum.INACTIVE }))} | ${false}
  `(
    "should return $scenario",
    async ({
      profileResult,
      serviceResult,
      servicePreferencesResult,
      activationResult,
      is_inbox_enabled,
    }) => {
      const profileModelMock = {
        findLastVersionByModelId: vi.fn(() => profileResult),
      };

      const servicePreferenceModelMock = {
        find: vi.fn((_) => servicePreferencesResult),
      };

      mockServiceFindLastVersionByModelId.mockImplementationOnce(
        () => serviceResult,
      );

      const mockActivation = {
        findLastVersionByModelId: vi.fn((_) => activationResult),
      };

      const getServicePreferencesHandler = GetServicePreferencesHandler(
        profileModelMock as any,
        serviceModelMock as any,
        servicePreferenceModelMock as any,
        mockActivation as any,
        mockRedisClientTask,
        DEFAULT_REDIS_SERVICE_CACHE_TTL,
      );

      const response = await getServicePreferencesHandler(
        aFiscalCode,
        aServiceId,
      );

      expect(response).toMatchObject({
        kind: "IResponseSuccessJson",
        value: {
          is_email_enabled: true,
          is_inbox_enabled,
          is_webhook_enabled: true,
          settings_version: aServicePreferenceVersion,
        },
      });
      expect(mockActivation.findLastVersionByModelId).toBeCalledTimes(1);
    },
  );

  it("should return IResponseErrorQuery if activation model raise an error for special service", async () => {
    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };
    mockServiceFindLastVersionByModelId.mockImplementationOnce(() =>
      TE.of(O.some(aRetrievedSpecialService)),
    );
    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(none)),
    };

    const mockActivation = {
      findLastVersionByModelId: vi.fn((_) => TE.left({})),
    };
    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      mockActivation as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery",
    });
    expect(mockServiceFindLastVersionByModelId).toBeCalledTimes(1);
    expect(servicePreferenceModelMock.find).toBeCalledTimes(1);
    expect(mockActivation.findLastVersionByModelId).toBeCalledTimes(1);
  });

  it("should correctly retrieve service from DB on cache MISS and SETEX failure", async () => {
    const anError = Error("anError");
    mockGet.mockResolvedValueOnce(null);
    mockSetEx.mockRejectedValueOnce(anError);

    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

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
    expect(mockServiceFindLastVersionByModelId).toHaveBeenCalledOnce();

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: aServicePreferenceVersion,
      },
    });
  });

  it("should correctly retrieve service from DB on cache get failure", async () => {
    const anError = Error("anError");
    mockGet.mockRejectedValueOnce(anError);

    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      mockRedisClientTask,
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

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
    expect(mockServiceFindLastVersionByModelId).toHaveBeenCalledOnce();

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: aServicePreferenceVersion,
      },
    });
  });

  it("should correctly retrieve service from DB on cache unavailable", async () => {
    const anError = Error("anError");

    const profileModelMock = {
      findLastVersionByModelId: vi.fn(() =>
        TE.of(some(aRetrievedProfileInValidState)),
      ),
    };

    const servicePreferenceModelMock = {
      find: vi.fn((_) => TE.of(some(aRetrievedServicePreference))),
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      serviceModelMock as any,
      servicePreferenceModelMock as any,
      {} as any,
      TE.left(anError),
      DEFAULT_REDIS_SERVICE_CACHE_TTL,
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId,
    );

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSetEx).not.toHaveBeenCalled();
    expect(mockServiceFindLastVersionByModelId).toHaveBeenCalledOnce();

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: aServicePreferenceVersion,
      },
    });
  });
});
