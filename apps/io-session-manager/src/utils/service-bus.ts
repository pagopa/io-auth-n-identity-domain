import {
  FeatureFlag,
  getIsUserEligibleForNewFeature,
} from "@pagopa/ts-commons/lib/featureFlag";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

export const getIsUserEligibleForServiceBusEvents = (
  betaTesters: ReadonlyArray<FiscalCode>,
  FF_SERVICE_BUS_EVENTS: FeatureFlag,
) =>
  getIsUserEligibleForNewFeature<FiscalCode>(
    (fiscalCode) => betaTesters.includes(fiscalCode),
    (_fiscalCode) => false,
    FF_SERVICE_BUS_EVENTS,
  );
