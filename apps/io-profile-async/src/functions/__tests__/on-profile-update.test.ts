import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { TelemetryClient } from "applicationinsights";
import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  IProfileEmailReader,
  IProfileEmailWriter
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { handler } from "../on-profile-update";
import { trackEventMock, trackerMock } from "../__mocks__/tracker.mock";
import {
  generateId,
  mockProfiles,
  onProfileUpdateFindDocumentMock,
  profileRepositoryMock
} from "../__mocks__/profile-repository.mock";
import {
  emailDeleteMock,
  emailInsertMock,
  profileEmailRepositoryMock
} from "../__mocks__/profile-email-repository.mock";
import { cosmosErrorsToString } from "../../utils/cosmos/errors";

const take = (id: string, arr: typeof mockProfiles) =>
  pipe(
    arr,
    A.filter(e => e.id === id)
  );

const mockDependencies = {
  ProfileRepository: profileRepositoryMock,
  ProfileEmailRepository: profileEmailRepositoryMock,
  TrackerRepository: trackerMock,
  // subdependencies (handled by the respective repository)
  dataTableProfileEmailsRepository: (null as unknown) as IProfileEmailWriter &
    IProfileEmailReader,
  profileModel: (null as unknown) as ProfileModel,
  telemetryClient: (null as unknown) as TelemetryClient
};

describe("handler function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call find, insert and delete methods with no errors and handler function should not return any E.left", async () => {
    const documents = mockProfiles;

    const result = await handler(documents)(mockDependencies)();
    expect(result).toEqual(E.right(void 0));

    const findIndices = [4, 5, 6, 8, 9, 11, 13];
    const expectedFindParams = findIndices.map(index => ({
      version: mockProfiles[index].version,
      fiscalCode: mockProfiles[index].fiscalCode
    }));
    expectedFindParams.forEach((param, index) => {
      expect(onProfileUpdateFindDocumentMock).toHaveBeenNthCalledWith(
        index + 1,
        param.fiscalCode,
        param.version - 1
      );
    });

    const insertIndices = [1, 2, 3, 5, 9, 19];
    const expectedInsertParams = insertIndices.map(index => ({
      email: mockProfiles[index].email,
      fiscalCode: mockProfiles[index].fiscalCode
    }));
    expectedInsertParams.forEach((param, index) => {
      expect(emailInsertMock).toHaveBeenNthCalledWith(index + 1, param);
    });
    expect(emailInsertMock).toHaveBeenCalledTimes(insertIndices.length);

    const deleteIndices = [3, 16];
    const expectedDeleteParams = deleteIndices.map(index => ({
      email: mockProfiles[index].email,
      fiscalCode: mockProfiles[index].fiscalCode
    }));
    expectedDeleteParams.forEach((param, index) => {
      expect(emailDeleteMock).toHaveBeenNthCalledWith(index + 1, param);
    });
    expect(emailDeleteMock).toHaveBeenCalledTimes(deleteIndices.length);
  });

  it("should call mockTelemetryClient.trackEvent when error in insertProfileEmail occurs and handler function should return E.left", async () => {
    const mockDocuments = take(
      generateId("DRUQIL23A18Y188X" as FiscalCode, 0 as NonNegativeInteger),
      mockProfiles
    );
    const anError = Error("Insert error");
    emailInsertMock.mockReturnValueOnce(RTE.left(anError));
    const result = await handler(mockDocuments)(mockDependencies)();

    expect(result).toEqual(E.left(anError));

    expect(trackEventMock).toHaveBeenCalled();
  });

  it("should call trackEvent when a decoding Error occurs and continue the process of other documents", async () => {
    const mockDocuments = [
      { wrong: "structure" },
      ...take(
        generateId("PVQEBX22A89Y092X" as FiscalCode, 0 as NonNegativeInteger),
        mockProfiles
      )
    ];

    const result = await handler(mockDocuments)(mockDependencies)();

    expect(result).toEqual(E.right(void 0));

    expect(trackEventMock).toHaveBeenCalledWith(
      "OnProfileUpdate.decodingProfile",
      undefined,
      false,
      {
        _self: "unknown-id"
      }
    );
  });

  it("should call mockTelemetryClient.trackEvent when error in find occurs and handler function should return E.left", async () => {
    const mockDocuments = take(
      generateId("PVQEBX22A89Y092X" as FiscalCode, 1 as NonNegativeInteger),
      mockProfiles
    );

    const expectedError = Error("Conflict error");

    onProfileUpdateFindDocumentMock.mockReturnValueOnce(
      RTE.left(
        Error(
          cosmosErrorsToString(({
            kind: "COSMOS_CONFLICT_RESPONSE"
          } as unknown) as CosmosErrors)
        )
      )
    );

    const result = await handler(mockDocuments)(mockDependencies)();

    expect(result).toEqual(E.left(expectedError));

    expect(trackEventMock).toHaveBeenCalled();
  });

  it("should call mockTelemetryClient.trackEvent when error in deleteProfileEmail occurs and handler function should return E.left", async () => {
    const mockDocuments = take(
      generateId("PVQEBX22A89Y092X" as FiscalCode, 1 as NonNegativeInteger),
      mockProfiles
    );

    const anError = Error("Delete error");

    emailDeleteMock.mockReturnValueOnce(RTE.left(anError));

    const result = await handler(mockDocuments)(mockDependencies)();

    expect(result).toEqual(E.left(anError));

    expect(trackEventMock).toHaveBeenCalled();
  });

  it("should concatenate all errors collected into a single one", async () => {
    const mockDocuments = take(
      generateId("PVQEBX22A89Y092X" as FiscalCode, 1 as NonNegativeInteger),
      mockProfiles
    );

  
    mockDocuments.push(
      ...take(
        generateId("VSFNVG14A39Y596X" as FiscalCode, 1 as NonNegativeInteger),
        mockProfiles
      )
    );

    const expectedError = Error(
      `Error:Conflict error;\nError:Empty response;\n`
    );
    onProfileUpdateFindDocumentMock.mockReturnValueOnce(
      RTE.left(
        Error(
          cosmosErrorsToString(({
            kind: "COSMOS_CONFLICT_RESPONSE"
          } as unknown) as CosmosErrors)
        )
      )
    );
    onProfileUpdateFindDocumentMock.mockReturnValueOnce(
      RTE.left(
        Error(
          cosmosErrorsToString(({
            kind: "COSMOS_EMPTY_RESPONSE"
          } as unknown) as CosmosErrors)
        )
      )
    );

    const result = await handler(mockDocuments)(mockDependencies)();

    assert(E.isLeft(result));
    expect(result.left).toEqual(expectedError);

    expect(trackEventMock).toHaveBeenCalledTimes(2);
  });
});
