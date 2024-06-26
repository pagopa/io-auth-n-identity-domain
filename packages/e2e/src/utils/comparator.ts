import assert from "assert";

/**
 * Execute a deep equal comparison of two object.
 * @param a the first object
 * @param b the second object
 * @returns true if the objects are deep equal false otherwise
 */
export const deepEqual: <T>(a: T, b: T) => boolean = (a, b) => {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch (_) {
    return false;
  }
};
