import { describe, expect, it } from "vitest";
import * as E from "fp-ts/lib/Either";
import { parseFilter } from "../fields-filter";

describe("ParseFilter", () => {
  it.each`
    title                                     | filter                   | expectedOutput
    ${"parse a correct filter"}               | ${"(a)"}                 | ${E.right(new Set(["a"]))}
    ${"parse a filter with multiple fields"}  | ${"(b,a)"}               | ${E.right(new Set(["a", "b"]))}
    ${"ignore duplicated fields"}             | ${"(b,b)"}               | ${E.right(new Set(["b"]))}
    ${"clear the empty spaces"}               | ${"    (   b , ,   )  "} | ${E.right(new Set(["b"]))}
    ${"give an Error when filter is invalid"} | ${""}                    | ${E.left(Error("0 Parameters provided to fields filter"))}
    ${"give an Error when filter is empty"}   | ${"()"}                  | ${E.left(Error("0 Parameters provided to fields filter"))}
  `("should $title", ({ filter, expectedOutput }) => {
    expect(parseFilter(filter)).toStrictEqual(expectedOutput);
  });
});
