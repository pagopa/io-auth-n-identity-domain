import { Container } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";
import {
  Profile,
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { TelemetryClient } from "applicationinsights";
import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { handler } from "../on-profile-update";
import { OnProfileUpdateDocument } from "../../types/on-profile-update-input-document";
import { ProfileEmailRepository, ProfileRepository } from "../../repositories";

const take = (id: string, arr: typeof mockProfiles) =>
  pipe(
    arr,
    A.filter(e => e.id === id)
  );

const generateId = (fiscalCode: FiscalCode, version: NonNegativeInteger) =>
  generateVersionedModelId<Profile, "fiscalCode">(fiscalCode, version);

const mockProfileEmailTableClient = {} as TableClient;

const mockDataTableProfileEmailsRepository = new DataTableProfileEmailsRepository(
  mockProfileEmailTableClient
);

vi.spyOn(
  mockDataTableProfileEmailsRepository,
  "insert"
).mockImplementation(() => Promise.resolve());

vi.spyOn(
  mockDataTableProfileEmailsRepository,
  "delete"
).mockImplementation(() => Promise.resolve());

const mockContainer = {} as Container;

const mockProfileModel = new ProfileModel(mockContainer);

const mockProfiles = [
  {
    email: "Eleanore.Kuphal@example.net",
    fiscalCode: "VSFNVG14A39Y596X",
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 0,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732c2"
  },
  {
    email: "Humberto38@example.net",
    fiscalCode: "DRUQIL23A18Y188X",
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 0,
    _self: "ba130521-8bab-4a68-a5e9-07a7e59f1f24"
  },
  {
    email: "cittadinanzadigitale@teamdigitale.governo.it",
    fiscalCode: "ISPXNB32R82Y766D",
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 0,
    _self: "57807630-19c0-4cbd-a53f-a9ba3c3e0660"
  },
  {
    email: "Reed_Klocko@example.com",
    fiscalCode: "PVQEBX22A89Y092X",
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 0,
    _self: "ad893263-21a5-43af-856b-88bc80fdb5a2"
  },
  {
    email: "derd@example.com",
    fiscalCode: "PVQEBX22A89Y092X",
    isEmailValidated: false,
    isInboxEnabled: false,
    acceptedTosVersion: 1,
    version: 1,
    _self: "19e3eeb9-0fc0-472b-8df9-b29eab5a2d50"
  },
  {
    email: "derd@example.com",
    fiscalCode: "PVQEBX22A89Y092X",
    isEmailValidated: true,
    isInboxEnabled: false,
    acceptedTosVersion: 2,
    version: 2,
    _self: "4b4c94d4-a350-4f27-9c76-ba669eca48a9"
  },
  {
    email: "cittadinanzadigitale@teamdigitale.governo.it",
    fiscalCode: "ISPXNB32R82Y766D",
    isEmailValidated: true,
    isInboxEnabled: false,
    acceptedTosVersion: 1,
    id: "ISPXNB32R82Y766D-0000000000000001",
    version: 1,
    _self: "eb28139a-f875-4276-81c5-b3f7b01f712a"
  },
  {
    fiscalCode: "not-valid",
    isEmailValidated: true,
    isInboxEnabled: false,
    acceptedTosVersion: 1,
    version: 0
  },
  {
    email: "Eleanore.Kuphal@example.net",
    fiscalCode: "VSFNVG14A39Y596X",
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 1,
    acceptedTosVersion: 0,
    _self: "aa406556-b003-4387-89ef-8f127ec9b2da"
  },
  {
    email: "Eleanore.Kuphal@example.net",
    fiscalCode: "VSFNVG14A39Y596X",
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 2,
    _self: "f43db63b-5549-403d-98a5-e781934c796f"
  },
  {
    fiscalCode: "AAANVG14A39Y596X",
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 0,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732c5"
  },
  {
    email: "newEmail@example.net",
    fiscalCode: "AAANVG14A39Y596X",
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 1,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732c6"
  },
  {
    email: "newEmail@example.net",
    fiscalCode: "BBBNVG14A39Y596X",
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 0,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732d7"
  },
  {
    fiscalCode: "BBBNVG14A39Y596X",
    isInboxEnabled: false,
    version: 1,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732e8"
  }
].map(item => ({
  ...item,
  id: generateId(
    item.fiscalCode as FiscalCode,
    item.version as NonNegativeInteger
  )
}));

vi.spyOn(mockProfileModel, "find").mockImplementation(([id, fiscalCode]) =>
  pipe(
    mockProfiles.find(
      profile => profile.id === id && profile.fiscalCode === fiscalCode
    ),
    foundProfile => TE.right(O.fromNullable(foundProfile as RetrievedProfile))
  )
);

const mockTelemetryClient = ({
  trackEvent: vi.fn()
} as unknown) as TelemetryClient;

const mockDependencies = {
  ProfileRepository,
  ProfileEmailRepository,
  dataTableProfileEmailsRepository: mockDataTableProfileEmailsRepository,
  profileModel: mockProfileModel,
  telemetryClient: mockTelemetryClient
};

describe("handler function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call find, insert and delete methods with no errors and handler function should not return any E.left", async () => {
    const documents = mockProfiles;

    const result = await handler(documents)(mockDependencies)();
    expect(E.isRight(result)).toBeTruthy();

    const findIndices = [4, 5, 6, 8, 9, 11, 13];
    const expectedFindParams = findIndices
      .map(index => ({
        version: mockProfiles[index].version,
        fiscalCode: mockProfiles[index].fiscalCode
      }))
      .map(item => [
        generateId(
          item.fiscalCode as FiscalCode,
          (item.version - 1) as NonNegativeInteger
        ),
        item.fiscalCode
      ]);
    expectedFindParams.forEach((param, index) => {
      expect(mockProfileModel.find).toHaveBeenNthCalledWith(index + 1, param);
    });

    const insertIndices = [1, 2, 3, 5, 9];
    const expectedInsertParams = insertIndices.map(index => ({
      email: mockProfiles[index].email,
      fiscalCode: mockProfiles[index].fiscalCode
    }));
    expectedInsertParams.forEach((param, index) => {
      expect(
        mockDataTableProfileEmailsRepository.insert
      ).toHaveBeenNthCalledWith(index + 1, param);
    });
    expect(mockDataTableProfileEmailsRepository.insert).toHaveBeenCalledTimes(
      insertIndices.length
    );

    expect(mockDataTableProfileEmailsRepository.delete).toHaveBeenNthCalledWith(
      1,
      {
        email: mockProfiles[3].email,
        fiscalCode: mockProfiles[3].fiscalCode
      }
    );
    expect(mockDataTableProfileEmailsRepository.delete).toHaveBeenCalledTimes(
      1
    );
  });

  it("should call mockTelemetryClient.trackEvent when error in insertProfileEmail occurs and handler function should return E.left", async () => {
    const mockDocuments = take(
      generateId("DRUQIL23A18Y188X" as FiscalCode, 0 as NonNegativeInteger),
      mockProfiles
    );

    vi.spyOn(
      mockDataTableProfileEmailsRepository,
      "insert"
    ).mockImplementationOnce(() => Promise.reject(new Error("Insert error")));

    const result = await handler(mockDocuments)(mockDependencies)();

    expect(E.isRight(result)).toBeFalsy();

    expect(mockTelemetryClient.trackEvent).toHaveBeenCalled();
  });

  it("should call mockTelemetryClient.trackEvent when error in find occurs and handler function should return E.left", async () => {
    const mockDocuments = take(
      generateId("PVQEBX22A89Y092X" as FiscalCode, 1 as NonNegativeInteger),
      mockProfiles
    );

    vi.spyOn(mockProfileModel, "find").mockImplementationOnce(() =>
      TE.left(({ kind: "COSMOS_CONFLICT_RESPONSE" } as unknown) as CosmosErrors)
    );

    const result = await handler(mockDocuments)(mockDependencies)();

    expect(E.isRight(result)).toBeFalsy();

    expect(mockTelemetryClient.trackEvent).toHaveBeenCalled();
  });

  it("should call mockTelemetryClient.trackEvent when error in deleteProfileEmail occurs and handler function should return E.left", async () => {
    const mockDocuments = take(
      generateId("PVQEBX22A89Y092X" as FiscalCode, 1 as NonNegativeInteger),
      mockProfiles
    );

    vi.spyOn(
      mockDataTableProfileEmailsRepository,
      "delete"
    ).mockImplementationOnce(() => Promise.reject(new Error("Delete error")));

    const result = await handler(mockDocuments)(mockDependencies)();

    expect(E.isRight(result)).toBeFalsy();

    expect(mockTelemetryClient.trackEvent).toHaveBeenCalled();
  });

  it("should concatenate all errors collected into a single one", async () => {
    const mockDocuments = take(
      generateId("PVQEBX22A89Y092X" as FiscalCode, 1 as NonNegativeInteger),
      mockProfiles
    );

    // eslint-disable-next-line functional/immutable-data
    mockDocuments.push(
      ...take(
        generateId("VSFNVG14A39Y596X" as FiscalCode, 1 as NonNegativeInteger),
        mockProfiles
      )
    );

    const expectedError = Error(
      `Error:Conflict error;\nError:Empty response;\n`
    );
    vi.spyOn(mockProfileModel, "find").mockImplementationOnce(() =>
      TE.left(({ kind: "COSMOS_EMPTY_RESPONSE" } as unknown) as CosmosErrors)
    );
    vi.spyOn(mockProfileModel, "find").mockImplementationOnce(() =>
      TE.left(({ kind: "COSMOS_CONFLICT_RESPONSE" } as unknown) as CosmosErrors)
    );

    const result = await handler(mockDocuments)(mockDependencies)();

    assert(E.isLeft(result));
    expect(result.left).toEqual(expectedError);

    expect(mockTelemetryClient.trackEvent).toHaveBeenCalledTimes(2);
  });
});

describe("ProfileDocument", () => {
  const baseProps = {
    _self: "a string",
    fiscalCode: "VSFNVG14A39Y596X",
    version: 0
  };

  it("should return E.right when decoding baseProps with isEmailValidated equal to true", () => {
    const res = OnProfileUpdateDocument.decode({
      ...baseProps,
      isEmailValidated: true
    });
    expect(res).toEqual(
      E.right({
        ...baseProps,
        isEmailValidated: true
      })
    );
  });

  it("should return E.right with isEmailValidated set to true when decoding baseProps", () => {
    const res = OnProfileUpdateDocument.decode(baseProps);
    expect(res).toEqual(E.right({ ...baseProps, isEmailValidated: true }));
  });

  it("should return E.right when decoding baseProps with isEmailValidated equal to false", () => {
    const res = OnProfileUpdateDocument.decode({
      ...baseProps,
      isEmailValidated: false
    });
    expect(res).toEqual(
      E.right({
        ...baseProps,
        isEmailValidated: false
      })
    );
  });
});
