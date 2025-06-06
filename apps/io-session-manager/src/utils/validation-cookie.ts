import {
  FeatureFlag,
  getIsUserEligibleForNewFeature,
} from "@pagopa/ts-commons/lib/featureFlag";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

export const getIsUserEligibleForValidationCookie = (
  betaTesters: ReadonlyArray<FiscalCode>,
  FF_ValidationCookie: FeatureFlag,
) =>
  getIsUserEligibleForNewFeature<FiscalCode>(
    (fiscalCode) => betaTesters.includes(fiscalCode),
    (_fiscalCode) => false,
    FF_ValidationCookie,
  );
