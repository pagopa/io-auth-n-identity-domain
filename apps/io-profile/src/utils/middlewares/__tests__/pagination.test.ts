/* eslint-disable sonarjs/no-duplicate-string */
import { Request } from "express";
import * as E from "fp-ts/lib/Either";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  PageQueryMiddleware,
  PageSize,
  PageSizeQueryMiddleware,
  PositiveIntegerFromString,
} from "../pagination";

type MockRequest = Pick<Request, "query"> & { query: Record<string, string> };

describe("PageSize codec", () => {
  it.each`
    scenario                                 | input        | expected
    ${"succeed on valid value within range"} | ${50}        | ${E.right(50)}
    ${"succeed on minimum valid value"}      | ${1}         | ${E.right(1)}
    ${"succeed on maximum valid value"}      | ${100}       | ${E.right(100)}
    ${"fail on zero value"}                  | ${0}         | ${E.left(expect.anything())}
    ${"fail on negative value"}              | ${-5}        | ${E.left(expect.anything())}
    ${"fail on greater than maximum value"}  | ${101}       | ${E.left(expect.anything())}
    ${"fail on non-integer value"}           | ${50.5}      | ${E.left(expect.anything())}
    ${"fail on string numeric value"}        | ${"50"}      | ${E.left(expect.anything())}
    ${"fail on non-numeric string"}          | ${"aString"} | ${E.left(expect.anything())}
  `(`should $scenario`, ({ input, expected }) => {
    const result = PageSize.decode(input);
    expect(result).toStrictEqual(expected);
  });
});

describe("PositiveIntegerFromString codec", () => {
  it.each`
    scenario                        | input        | expected
    ${"succeed on valid value"}     | ${"1"}       | ${E.right(1)}
    ${"fail on zero value"}         | ${"0"}       | ${E.left(expect.anything())}
    ${"fail on negative value"}     | ${"-5"}      | ${E.left(expect.anything())}
    ${"fail on non-numeric string"} | ${"aString"} | ${E.left(expect.anything())}
  `(`should $scenario`, ({ input, expected }) => {
    const result = PositiveIntegerFromString.decode(input);
    expect(result).toStrictEqual(expected);
  });
});

describe("PageSizeQueryMiddleware", () => {
  it.each`
    scenario                                          | input                       | expected
    ${"succeed on valid page_size"}                   | ${{ page_size: "50" }}      | ${E.right(50)}
    ${"return the Default when page_size is missing"} | ${{}}                       | ${E.right(DEFAULT_PAGE_SIZE)}
    ${"fail on page_size 0"}                          | ${{ page_size: "0" }}       | ${E.left(expect.anything())}
    ${"fail on negative value"}                       | ${{ page_size: "-5" }}      | ${E.left(expect.anything())}
    ${"fail on page size over 100"}                   | ${{ page_size: "150" }}     | ${E.left(expect.anything())}
    ${"fail on decimal page_size"}                    | ${{ page_size: "50.5" }}    | ${E.left(expect.anything())}
    ${"fail on non-numeric string"}                   | ${{ page_size: "aString" }} | ${E.left(expect.anything())}
  `(`should $scenario`, async ({ input, expected }) => {
    const mockRequest: MockRequest = {
      query: input,
    };
    const result = await PageSizeQueryMiddleware(mockRequest as Request);
    expect(result).toStrictEqual(expected);
  });
});

describe("PageQueryMiddleware", () => {
  it.each`
    scenario                                     | input                  | expected
    ${"succeed on valid page"}                   | ${{ page: "1" }}       | ${E.right(1)}
    ${"return the Default when page is missing"} | ${{}}                  | ${E.right(DEFAULT_PAGE)}
    ${"fail on page 0"}                          | ${{ page: "0" }}       | ${E.left(expect.anything())}
    ${"fail on negative value"}                  | ${{ page: "-5" }}      | ${E.left(expect.anything())}
    ${"fail on decimal page"}                    | ${{ page: "50.5" }}    | ${E.left(expect.anything())}
    ${"fail on non-numeric string"}              | ${{ page: "aString" }} | ${E.left(expect.anything())}
  `(`should $scenario`, async ({ input, expected }) => {
    const mockRequest: MockRequest = {
      query: input,
    };
    const result = await PageQueryMiddleware(mockRequest as Request);
    expect(result).toStrictEqual(expected);
  });
});
