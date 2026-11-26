import {
  type SpidAuthLevel,
  type SpidLevel,
} from "../domain/value-objects/login.vo.js";

export const toFullyQualifiedSpidLevel = (level: SpidAuthLevel): SpidLevel =>
  `https://www.spid.gov.it/${level}`;

const SPID_LEVEL_ORDER: Record<SpidLevel, number> = {
  "https://www.spid.gov.it/SpidL1": 1,
  "https://www.spid.gov.it/SpidL2": 2,
  "https://www.spid.gov.it/SpidL3": 3,
};

/**
 * Returns `true` if the granted SPID level (canonical URL, as carried by the
 * `acr` claim) is equal or greater than the required `minAuthLevel`
 * (SpidL1 < SpidL2 < SpidL3).
 */
export const isSpidLevelGreaterOrEqual = (
  grantedLevel: SpidLevel,
  minAuthLevel: SpidAuthLevel,
): boolean =>
  SPID_LEVEL_ORDER[grantedLevel] >=
  SPID_LEVEL_ORDER[toFullyQualifiedSpidLevel(minAuthLevel)];
