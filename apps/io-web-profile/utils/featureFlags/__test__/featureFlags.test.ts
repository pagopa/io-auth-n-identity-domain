import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  FeatureFlagEnum,
  getIsUserEligibleForNewFeature
} from "../featureFlags";

const aFiscalCode = "ISPXNB32R82Y766D" as FiscalCode;
const anotherFiscalCode = "ISPXNB32R82Y766X" as FiscalCode;

const betaUsers: ReadonlyArray<FiscalCode> = [aFiscalCode];

const isUserBeta = (fc: FiscalCode): boolean => betaUsers.includes(fc);

describe("isUserForFeatureFlag", () => {
  it("should return true when featureFlag === all", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => false,
      FeatureFlagEnum.ALL
    );
    expect(isUserForFeatureFlag(aFiscalCode)).toBeTruthy();
  });

  it("should return false when featureFlag === beta and the user is not beta", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => false,
      FeatureFlagEnum.BETA
    );
    expect(isUserForFeatureFlag(anotherFiscalCode)).toBeFalsy();
  });

  it("should return true when featureFlag === beta and the first callback return true", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => false,
      FeatureFlagEnum.BETA
    );
    expect(isUserForFeatureFlag(aFiscalCode)).toBeTruthy();
  });

  it("should return false when featureFlag === canary and callbacks return false", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => false,
      FeatureFlagEnum.CANARY
    );
    expect(isUserForFeatureFlag(anotherFiscalCode)).toBeFalsy();
  });

  it("should return true when featureFlag === canary and the first callback return true", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => false,
      FeatureFlagEnum.CANARY
    );
    expect(isUserForFeatureFlag(aFiscalCode)).toBeTruthy();
  });

  it("should return true when featureFlag === canary and the second callback return true", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => true,
      FeatureFlagEnum.CANARY
    );
    expect(isUserForFeatureFlag(anotherFiscalCode)).toBeTruthy();
  });

  it("should return false when featureFlag === none", () => {
    const isUserForFeatureFlag = getIsUserEligibleForNewFeature(
      isUserBeta,
      _ => true,
      FeatureFlagEnum.NONE
    );
    expect(isUserForFeatureFlag(aFiscalCode)).toBeFalsy();
  });
});
