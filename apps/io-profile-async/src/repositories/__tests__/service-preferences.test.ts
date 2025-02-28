import { Mock, describe, expect, it, vi } from "vitest";

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { CosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { repository } from "../service-preferences";

describe("service-preferences repository", () => {
  const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;

  const aServicePreference: NewServicePreference = {
    accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN,
    fiscalCode: aFiscalCode,
    id: makeServicesPreferencesDocumentId(
      aFiscalCode,
      "MyServiceId" as ServiceId,
      0 as NonNegativeInteger
    ),
    serviceId: "MyServiceId" as ServiceId,
    settingsVersion: 0 as NonNegativeInteger,
    kind: "INewServicePreference" as const,
    isEmailEnabled: true,
    isInboxEnabled: false,
    isWebhookEnabled: true
  };

  const toRetrivedServicePreference = (newDocument: NewServicePreference) => ({
    ...newDocument,
    kind: "IRetrievedServicePreference" as const,
    _rid: "tbAzAI8Cu4EFAAAAAAAAAA==",
    _self: "dbs/tbAzAA==/colls/tbAzAI8Cu4E=/docs/tbAzAI8Cu4EFAAAAAAAAAA==/",
    _etag: '"35006a7b-0000-0d00-0000-60e3044f0000"',
    _ts: 1625490511
  });

  // ------------------
  // Mocks
  // ------------------

  const createServicePreferenceMock: Mock<
    Parameters<ServicesPreferencesModel["create"]>,
    ReturnType<ServicesPreferencesModel["create"]>
  > = vi.fn((newDocument: NewServicePreference) =>
    TE.of(toRetrivedServicePreference(newDocument))
  );

  const mockServicesPreferencesModel = ({
    create: createServicePreferenceMock
  } as unknown) as ServicesPreferencesModel;

  // ------------------
  // Tests
  // ------------------

  it("should return true when a new service preference has been created", async () => {
    const result = await repository.createServicePreference(aServicePreference)(
      {
        servicePreferenceModel: mockServicesPreferencesModel
      }
    )();

    expect(result).toEqual(E.of(true));
  });

  it("should return false when creation fails with conflict", async () => {
    createServicePreferenceMock.mockImplementationOnce(() =>
      TE.left(CosmosErrorResponse({ name: "", message: "", code: 409 }))
    );

    const result = await repository.createServicePreference(aServicePreference)(
      {
        servicePreferenceModel: mockServicesPreferencesModel
      }
    )();

    expect(result).toEqual(E.of(false));
  });

  it("should return an error when something went wrong creating the service preference", async () => {
    createServicePreferenceMock.mockImplementationOnce(() =>
      TE.left(CosmosErrorResponse({ name: "", message: "", code: 500 }))
    );

    const result = await repository.createServicePreference(aServicePreference)(
      {
        servicePreferenceModel: mockServicesPreferencesModel
      }
    )();

    expect(result).toEqual(
      E.left(
        expect.objectContaining({
          message: expect.stringContaining(
            "Can not create the service preferences"
          )
        })
      )
    );
  });
});
