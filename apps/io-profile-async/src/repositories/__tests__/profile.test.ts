import { beforeEach, describe, vi, it, expect } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import {
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { ProfileRepository } from "../profile";
import { mockProfiles } from "../../functions/__mocks__/profile-repository.mock";
import { FiscalCode } from "../../generated/definitions/function-profile/FiscalCode";
import { cosmosErrorsToString } from "../../utils/cosmos/errors";

const aRetrievedProfile: RetrievedProfile = {
  ...mockProfiles[0],
  servicePreferencesSettings: {
    mode: ServicesPreferencesModeEnum.AUTO,
    version: 0 as NonNegativeInteger
  },
  _self: "6aef1909-a8dc-4240-9f03-57412d603c42",
  kind: "IRetrievedProfile",
  _rid: "",
  _ts: 1,
  _etag: ""
};

const findMock = vi.fn().mockReturnValue(TE.right(O.some(aRetrievedProfile)));
const profileModelMock = ({
  find: findMock
} as unknown) as ProfileModel;

describe("Profile repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed finding a profile and return a correct document", async () => {
    const result = await ProfileRepository.onProfileUpdateFindDocument(
      mockProfiles[0].fiscalCode,
      0 as NonNegativeInteger
    )({
      profileModel: profileModelMock
    })();

    expect(result).toEqual(E.right(O.some(aRetrievedProfile)));
  });

  it("should succeed when no profile was found", async () => {
    findMock.mockReturnValueOnce(TE.right(O.none));

    const result = await ProfileRepository.onProfileUpdateFindDocument(
      mockProfiles[0].fiscalCode,
      0 as NonNegativeInteger
    )({
      profileModel: profileModelMock
    })();

    expect(result).toEqual(E.right(O.none));
  });

  it("should return a cosmos error in case something went wrong", async () => {
    const expectedError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;
    findMock.mockReturnValueOnce(TE.left(expectedError));

    const result = await ProfileRepository.onProfileUpdateFindDocument(
      mockProfiles[0].fiscalCode,
      0 as NonNegativeInteger
    )({
      profileModel: profileModelMock
    })();

    expect(result).toEqual(E.left(Error(cosmosErrorsToString(expectedError))));
  });

  it("should return a report if decoding went wrong", async () => {
    findMock.mockReturnValueOnce(TE.right(O.some({ foo: "bar" })));

    const result = await ProfileRepository.onProfileUpdateFindDocument(
      mockProfiles[0].fiscalCode,
      0 as NonNegativeInteger
    )({
      profileModel: profileModelMock
    })();

    expect(result).toMatchObject(
      E.left({
        message: expect.stringContaining("is not a valid")
      })
    );
  });
});
