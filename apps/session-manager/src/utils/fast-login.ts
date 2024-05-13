import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { FeatureFlag } from "../types/fature-flag";
import { LoginTypeEnum } from "../types/fast-login";
import { getIsUserEligibleForNewFeature } from "./feature-flag";

export const getIsUserElegibleForfastLogin = (
  betaTesters: ReadonlyArray<FiscalCode>,
  FF_FastLogin: FeatureFlag,
) =>
  getIsUserEligibleForNewFeature<FiscalCode>(
    (fiscalCode) => betaTesters.includes(fiscalCode),
    (_fiscalCode) => false,
    FF_FastLogin,
  );

export const getLoginTypeOnElegible = (
  loginType: LoginTypeEnum | undefined,
  isUserEligibleForFastLogin: boolean,
  isLollipopEnabled: boolean,
): LoginTypeEnum =>
  isLollipopEnabled &&
  loginType === LoginTypeEnum.LV &&
  isUserEligibleForFastLogin
    ? LoginTypeEnum.LV
    : LoginTypeEnum.LEGACY;
