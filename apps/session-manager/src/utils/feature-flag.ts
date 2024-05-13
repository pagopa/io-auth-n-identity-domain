import { FeatureFlag } from "../types/fature-flag";

export const getIsUserEligibleForNewFeature =
  <T>(
    isUserBeta: (i: T) => boolean,
    isUserCanary: (i: T) => boolean,
    featureFlag: FeatureFlag,
  ): ((i: T) => boolean) =>
  (i): boolean => {
    switch (featureFlag) {
      case "ALL":
        return true;
      case "BETA":
        return isUserBeta(i);
      case "CANARY":
        return isUserCanary(i) || isUserBeta(i);
      case "NONE":
        return false;
      default:
        return false;
    }
  };
