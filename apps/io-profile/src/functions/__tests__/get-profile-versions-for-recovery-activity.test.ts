import * as E from "fp-ts/lib/Either";
import { describe, expect, it, vi } from "vitest";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { context as contextMock } from "../__mocks__/durable-functions";
import { aFiscalCode, aRetrievedProfile } from "../__mocks__/mocks";
import {
  ActivityName,
  ActivityResult,
  getGetProfileVersionsForRecoveryActivityHandler,
} from "../get-profile-versions-for-recovery-activity";
import { TransientFailure } from "../../utils/durable";

const createMockIterator = (pages: ReadonlyArray<ReadonlyArray<unknown>>) =>
  (async function* () {
    for (const page of pages) {
      yield page;
    }
  })();

const createProfileModelMock = (
  calls: ReadonlyArray<ReadonlyArray<ReadonlyArray<unknown>>>,
): ProfileModel => {
  const getQueryIterator = vi.fn();
  calls.forEach((pages) => {
    getQueryIterator.mockReturnValueOnce(createMockIterator(pages));
  });
  return {
    getQueryIterator,
  } as unknown as ProfileModel;
};

describe(ActivityName, () => {
  it("should return modes and undefined previousMode for a v0 first profile", async () => {
    const profileModel = createProfileModelMock([[[E.right(aRetrievedProfile)]]]);
    const handler =
      getGetProfileVersionsForRecoveryActivityHandler(profileModel);

    const result = await handler(
      {
        endTimestamp: 86400,
        fiscalCode: aFiscalCode,
        startTimestamp: 0,
      },
      contextMock,
    );

    const decoded = ActivityResult.decode(result);
    expect(E.isRight(decoded)).toBe(true);
    if (E.isRight(decoded)) {
      expect(decoded.right.kind).toBe("FOUND");
      if (decoded.right.kind === "FOUND") {
        expect(decoded.right.currentDayModes).toHaveLength(1);
        expect(decoded.right.previousMode).toBeUndefined();
        expect(decoded.right.lastVersion).toBe(aRetrievedProfile.version);
        expect(decoded.right.lastTimestamp).toBe(aRetrievedProfile._ts);
      }
    }
  });

  it("should return the previous mode when the first profile is not v0", async () => {
    const firstProfile = { ...aRetrievedProfile, version: 1 };
    const previousProfile = {
      ...aRetrievedProfile,
      servicePreferencesSettings: {
        mode: ServicesPreferencesModeEnum.MANUAL,
        version: 1,
      },
      version: 0,
    };
    const profileModel = createProfileModelMock([
      [[E.right(firstProfile)]],
      [[E.right(previousProfile)]],
    ]);
    const handler =
      getGetProfileVersionsForRecoveryActivityHandler(profileModel);

    const result = await handler(
      {
        endTimestamp: 86400,
        fiscalCode: aFiscalCode,
        startTimestamp: 0,
      },
      contextMock,
    );

    const decoded = ActivityResult.decode(result);
    expect(E.isRight(decoded)).toBe(true);
    if (E.isRight(decoded)) {
      expect(decoded.right.kind).toBe("FOUND");
      if (decoded.right.kind === "FOUND") {
        expect(decoded.right.previousMode).toBe(
          ServicesPreferencesModeEnum.MANUAL,
        );
        expect(decoded.right.currentDayModes).toEqual([ServicesPreferencesModeEnum.LEGACY]);
        expect(decoded.right.lastVersion).toBe(firstProfile.version);
      }
    }
  });

  it("should return NOT_FOUND when the previous version is missing", async () => {
    const firstProfile = { ...aRetrievedProfile, version: 1 };
    const profileModel = createProfileModelMock([
      [[E.right(firstProfile)]],
      [[]],
    ]);
    const handler =
      getGetProfileVersionsForRecoveryActivityHandler(profileModel);

    const result = await handler(
      {
        endTimestamp: 86400,
        fiscalCode: aFiscalCode,
        startTimestamp: 0,
      },
      contextMock,
    );

    expect(result).toEqual({ kind: "NOT_FOUND" });
  });

  it("should return NOT_FOUND when the day has no profiles", async () => {
    const handler = getGetProfileVersionsForRecoveryActivityHandler(
      createProfileModelMock([[[]]]),
    );

    const result = await handler(
      { endTimestamp: 86400, fiscalCode: aFiscalCode, startTimestamp: 0 },
      contextMock,
    );

    expect(result).toEqual({ kind: "NOT_FOUND" });
  });

  it("should return TRANSIENT_FAILURE when the input is invalid", async () => {
    const handler = getGetProfileVersionsForRecoveryActivityHandler(
      createProfileModelMock([]),
    );

    const result = await handler({ invalid: "input" }, contextMock);

    const decoded = ActivityResult.decode(result);
    expect(E.isRight(decoded)).toBe(true);
    if (E.isRight(decoded)) {
      expect(decoded.right).toEqual(
        TransientFailure.encode({
          kind: "TRANSIENT_FAILURE",
          reason: "Invalid activity input",
        }),
      );
    }
  });
});
