import { ReadOnlyNonEmptySet } from "@pagopa/ts-commons/lib/types";

export enum SpidLevel {
  L1 = "https://www.spid.gov.it/SpidL1",
  L2 = "https://www.spid.gov.it/SpidL2",
  L3 = "https://www.spid.gov.it/SpidL3"
}

type SpidComparison = Record<SpidLevel, ReadOnlyNonEmptySet<SpidLevel>>;

const spidComparison: SpidComparison = {
  [SpidLevel.L1]: new Set([SpidLevel.L1]),
  [SpidLevel.L2]: new Set([SpidLevel.L1, SpidLevel.L2]),
  [SpidLevel.L3]: new Set([SpidLevel.L1, SpidLevel.L2, SpidLevel.L3])
};

/**
 * Checks if the value of `a` is greater than or equal to the value of `b` based on the comparison defined in the `spidComparison` object.
 *
 * @param {SpidLevel} a - The first value to compare.
 * @param {SpidLevel} b - The second value to compare.
 * @returns {boolean} Returns `true` if the value of `a` is greater than or equal to the value of `b`, otherwise returns `false`.
 */
export const gte = (a: SpidLevel, b: SpidLevel): boolean =>
  spidComparison[a].has(b);
