import * as E from "fp-ts/Either";
import * as t from "io-ts";
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

  return createAsyncIterator(results, shouldThrow);
};

/**
 * Helper function to create an async iterator with given results.
 */
const createAsyncIterator = <T>(
  results: ReadonlyArray<T>,
  shouldThrow: boolean = false,
) => ({
  [Symbol.asyncIterator]() {
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
});

/**
 * Creates a mock async iterator with mixed results (both successes and failures).
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

  return createAsyncIterator(results);
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

/**
 * Creates a mock async iterator with validation errors.
 *
 * @param resources - Array of RetrievedProfile items
 * @param validationErrorIndices - Array of indices where validation errors should be injected
 * @returns An async iterable with t.Validation results (io-ts validation errors)
 */
export const createMockProfileAsyncIteratorWithValidationErrors = (
  resources: ReadonlyArray<RetrievedProfile>,
  validationErrorIndices: ReadonlyArray<number> = [],
) => {
  const results = resources.map((r, index) =>
    validationErrorIndices.includes(index)
      ? E.left([
          {
            value: r,
            context: [{ key: "version", type: t.number }],
            message: `Invalid profile at index ${index}`,
          },
        ] as t.Errors)
      : E.right(r),
  );

  return createAsyncIterator(results);
};
