import * as E from "fp-ts/Either";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

/**
 * Creates a mock async iterator for Cosmos DB query results.
 * This simulates the behavior of profileModel.getQueryIterator()
 *
 * @param resources - Array of RetrievedProfile items to return
 * @param shouldThrow - If true, the iterator will throw an error on next()
 * @returns An async iterable that yields arrays of Either<Error, RetrievedProfile>
 */
export const createMockProfileAsyncIterator = (
  resources: ReadonlyArray<RetrievedProfile>,
  shouldThrow: boolean = false,
) => {
  const results = resources.map((r) => E.right(r));

  return {
    [Symbol.asyncIterator]() {
      // eslint-disable-next-line functional/no-let
      let done = false;
      return {
        async next() {
          if (shouldThrow) {
            throw new Error("Cosmos DB query error");
          }

          if (!done) {
            done = true;
            return {
              value: results,
              done: false,
            };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
};

/**
 * Creates a mock async iterator with mixed results (both successes and failures).
 * Useful for testing error handling in partial query failures.
 *
 * @param resources - Array of RetrievedProfile items (will be wrapped in E.right)
 * @param errorIndices - Array of indices where E.left errors should be injected
 * @returns An async iterable with mixed Either results
 */
export const createMockProfileAsyncIteratorWithErrors = (
  resources: ReadonlyArray<RetrievedProfile>,
  errorIndices: ReadonlyArray<number> = [],
) => {
  const results = resources.map((r, index) =>
    errorIndices.includes(index)
      ? E.left(new Error(`Error at index ${index}`))
      : E.right(r),
  );

  return {
    [Symbol.asyncIterator]() {
      // eslint-disable-next-line functional/no-let
      let done = false;
      return {
        async next() {
          if (!done) {
            done = true;
            return {
              value: results,
              done: false,
            };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
};

/**
 * Creates a profile version helper for testing pagination scenarios.
 *
 * @param baseProfile - Base RetrievedProfile to use as template
 * @param version - Version number for this profile
 * @param tsOffsetSeconds - Offset in seconds from current timestamp (negative = past)
 * @returns A RetrievedProfile with updated version and timestamp
 */
export const createProfileVersion = (
  baseProfile: RetrievedProfile,
  version: number,
  tsOffsetSeconds: number = 0,
): RetrievedProfile => {
  const currentTimestamp = Math.floor(new Date().valueOf() / 1000);
  return {
    ...baseProfile,
    version: version as NonNegativeInteger,
    _ts: currentTimestamp + tsOffsetSeconds,
  };
};
