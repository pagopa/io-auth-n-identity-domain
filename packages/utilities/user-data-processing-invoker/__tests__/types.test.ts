import { describe, it, expect } from "vitest";
import * as E from "fp-ts/Either";
import { ApiUrlWithFiscalCode } from "../types";

describe("ApiUrlWithFiscalCode codec", () => {
  it("should succeed for a string with exactly one {fiscalCode}", () => {
    const input = "https://example.com/users/{fiscalCode}/status";
    const result = ApiUrlWithFiscalCode.decode(input);
    expect(E.isRight(result)).toBe(true);
    expect(result).toEqual(E.right(input));
  });

  it("should fail if string has no {fiscalCode}", () => {
    const input = "https://example.com/users/status";
    const result = ApiUrlWithFiscalCode.decode(input);
    expect(E.isLeft(result)).toBe(true);
    expect(result).toEqual(
      E.left([
        {
          value: input,
          context: expect.any(Array),
          message: "Must contain exactly one {fiscalCode}",
        },
      ]),
    );
  });

  it("should fail if string has more than one {fiscalCode}", () => {
    const input = "https://example.com/{fiscalCode}/users/{fiscalCode}/status";
    const result = ApiUrlWithFiscalCode.decode(input);
    expect(E.isLeft(result)).toBe(true);
    expect(result).toEqual(
      E.left([
        {
          value: input,
          context: expect.any(Array),
          message: "Must contain exactly one {fiscalCode}",
        },
      ]),
    );
  });

  it("should fail for non-string values", () => {
    const input = 42;
    const result = ApiUrlWithFiscalCode.decode(input);
    expect(E.isLeft(result)).toBe(true);
  });

  it("should work with complex URLs as long as there is exactly one {fiscalCode}", () => {
    const input = "https://api.example.com/v1/users/{fiscalCode}?filter=active";
    const result = ApiUrlWithFiscalCode.decode(input);
    expect(E.isRight(result)).toBe(true);
    expect(result).toEqual(E.right(input));
  });
});
