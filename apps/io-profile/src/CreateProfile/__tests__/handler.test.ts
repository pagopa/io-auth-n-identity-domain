import lolex from "lolex";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import df from "durable-functions";

import { NewProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import * as date_fns from "date-fns";
import * as E from "fp-ts/lib/Either";
import { identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import {
  context as contextMock,
  mockGetClient,
  mockStartNew,
} from "../../__mocks__/durable-functions";
import {
  aExtendedProfile,
  aFiscalCode,
  aNewDate,
  aNewProfile,
  aRetrievedProfile,
} from "../../__mocks__/mocks";
import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "../../UpsertedProfileOrchestrator/handler";
import { fail } from "../../utils/test-utils";
import { CreateProfileHandler } from "../handler";

let clock: any;
const spyGetClient = vi.spyOn(df, "getClient");
spyGetClient.mockImplementation(mockGetClient);
beforeEach(() => {
  spyGetClient.mockClear();
  clock = lolex.install({ now: Date.now() });
});
afterEach(() => {
  clock = clock.uninstall();
});

const anOptOutEmailSwitchDate = pipe(
  UTCISODateFromString.decode("2021-07-08T23:59:59Z"),
  E.getOrElseW(() => fail("wrong date value")),
);

const aPastOptOutEmailSwitchDate = pipe(
  UTCISODateFromString.decode("2000-07-08T23:59:59Z"),
  E.getOrElseW(() => fail("wrong date value")),
);

const aFutureOptOutEmailSwitchDate = date_fns.addDays(aNewDate, 1);

const aTestProfileWithEmailDisabled = {
  ...aRetrievedProfile,
  isEmailEnabled: false,
};

const expectedNewProfile = pipe(
  NewProfile.decode({
    email: aNewProfile.email,
    fiscalCode: aFiscalCode,
    isEmailEnabled: false,
    isEmailValidated: aNewProfile.is_email_validated,
    isInboxEnabled: false,
    isTestProfile: aNewProfile.is_test_profile,
    isWebhookEnabled: false,
    kind: "INewProfile",
  }),
  E.fold(() => fail("wrong new Profile"), identity),
);

describe("CreateProfileHandler", () => {
  it("should return a query error when an error occurs creating the new profile", async () => {
    const profileModelMock = {
      create: vi.fn(() => TE.left({})),
    };

    const createProfileHandler = CreateProfileHandler(
      profileModelMock as any,
      anOptOutEmailSwitchDate,
    );

    const result = await createProfileHandler(
      contextMock as any,
      undefined as any,
      {} as any,
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return the created profile", async () => {
    const profileModelMock = {
      create: vi.fn(() => TE.of(aRetrievedProfile)),
    };

    const createProfileHandler = CreateProfileHandler(
      profileModelMock as any,
      anOptOutEmailSwitchDate,
    );

    const result = await createProfileHandler(
      contextMock as any,
      aFiscalCode,
      aNewProfile,
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aExtendedProfile);
    }
  });

  it("should return the created profile with is_email_enabled set to false", async () => {
    const profileModelMock = {
      create: vi.fn((_) => TE.of(aTestProfileWithEmailDisabled)),
    };

    const createProfileHandler = CreateProfileHandler(
      profileModelMock as any,
      aPastOptOutEmailSwitchDate,
    );

    const result = await createProfileHandler(
      contextMock as any,
      aFiscalCode,
      aNewProfile,
    );

    expect(profileModelMock.create).toBeCalledWith(expectedNewProfile);
    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual({
        ...aExtendedProfile,
        is_email_enabled: false,
      });
    }
  });

  it("should return the created profile with is_email_enabled set to true if limit date is after profile creation date", async () => {
    const profileModelMock = {
      create: vi.fn((_) => TE.of(aRetrievedProfile)),
    };

    const createProfileHandler = CreateProfileHandler(
      profileModelMock as any,
      aFutureOptOutEmailSwitchDate,
    );

    const result = await createProfileHandler(
      contextMock as any,
      aFiscalCode,
      aNewProfile,
    );

    expect(profileModelMock.create).toBeCalledWith({
      ...expectedNewProfile,
      isEmailEnabled: true,
    });
    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aExtendedProfile);
    }
  });

  it("should start the orchestrator with the appropriate input after the profile has been created", async () => {
    const profileModelMock = {
      create: vi.fn(() => TE.of(aRetrievedProfile)),
    };
    const createProfileHandler = CreateProfileHandler(
      profileModelMock as any,
      anOptOutEmailSwitchDate,
    );

    await createProfileHandler(contextMock as any, aFiscalCode, {} as any);

    const upsertedProfileOrchestratorInput =
      UpsertedProfileOrchestratorInput.encode({
        newProfile: aRetrievedProfile,
        updatedAt: new Date(),
      });

    expect(spyGetClient).toHaveBeenCalledTimes(1);
    expect(mockStartNew).toHaveBeenCalledWith(
      "UpsertedProfileOrchestrator",
      undefined,
      upsertedProfileOrchestratorInput,
    );
  });
});
