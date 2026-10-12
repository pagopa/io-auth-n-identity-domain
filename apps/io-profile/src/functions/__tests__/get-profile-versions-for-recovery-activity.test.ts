import * as E from "fp-ts/lib/Either";
import { describe, expect, it, vi } from "vitest";
import {
  ProfileModel,
  RetrievedProfile,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { context as contextMock } from "../__mocks__/durable-functions";
import { aFiscalCode, aRetrievedProfile } from "../__mocks__/mocks";
import {
  ActivityName,
  ActivityResult,
  getGetProfileVersionsForRecoveryActivityHandler,
} from "../get-profile-versions-for-recovery-activity";
import { PermanentFailure } from "../../utils/durable";

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

const aProfileVersion = (
  version: number,
  mode: ServicesPreferencesModeEnum,
): RetrievedProfile => ({
  ...aRetrievedProfile,
  _ts: (version + 1) * 1000,
  servicePreferencesSettings: {
    mode,
    version:
      mode === ServicesPreferencesModeEnum.LEGACY ? -1 : (version as number),
  } as RetrievedProfile["servicePreferencesSettings"],
  version: version as NonNegativeInteger,
});

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

  it("should collect the modes of every page returned by the window query", async () => {
    const profileModel = createProfileModelMock([
      [
        [
          E.right(aProfileVersion(0, ServicesPreferencesModeEnum.LEGACY)),
          E.right(aProfileVersion(1, ServicesPreferencesModeEnum.AUTO)),
        ],
        [E.right(aProfileVersion(2, ServicesPreferencesModeEnum.MANUAL))],
        [E.right(aProfileVersion(3, ServicesPreferencesModeEnum.AUTO))],
      ],
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

    expect(result).toEqual({
      currentDayModes: [
        ServicesPreferencesModeEnum.LEGACY,
        ServicesPreferencesModeEnum.AUTO,
        ServicesPreferencesModeEnum.MANUAL,
        ServicesPreferencesModeEnum.AUTO,
      ],
      kind: "FOUND",
      lastTimestamp: 4000,
      lastVersion: 3,
      previousMode: undefined,
    });
    // no lookup for the previous version, the first profile is a v0
    expect(profileModel.getQueryIterator).toHaveBeenCalledTimes(1);
  });

  it("should return the previous mode when the window query spans multiple pages", async () => {
    const profileModel = createProfileModelMock([
      [
        [E.right(aProfileVersion(4, ServicesPreferencesModeEnum.AUTO))],
        [
          E.right(aProfileVersion(5, ServicesPreferencesModeEnum.MANUAL)),
          E.right(aProfileVersion(6, ServicesPreferencesModeEnum.AUTO)),
        ],
      ],
      [[E.right(aProfileVersion(3, ServicesPreferencesModeEnum.LEGACY))]],
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

    expect(result).toEqual({
      currentDayModes: [
        ServicesPreferencesModeEnum.AUTO,
        ServicesPreferencesModeEnum.MANUAL,
        ServicesPreferencesModeEnum.AUTO,
      ],
      kind: "FOUND",
      lastTimestamp: 7000,
      lastVersion: 6,
      previousMode: ServicesPreferencesModeEnum.LEGACY,
    });
    expect(profileModel.getQueryIterator).toHaveBeenCalledTimes(2);
  });

  it("should return PERMANENT_FAILURE when a profile of a following page cannot be decoded", async () => {
    const profileModel = createProfileModelMock([
      [
        [E.right(aProfileVersion(0, ServicesPreferencesModeEnum.LEGACY))],
        [E.left([])],
      ],
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

    expect(result).toEqual(
      PermanentFailure.encode({
        kind: "PERMANENT_FAILURE",
        reason: "Unexpected activity error",
      }),
    );
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
        PermanentFailure.encode({
          kind: "PERMANENT_FAILURE",
          reason: "Invalid activity input",
        }),
      );
    }
  });
});
