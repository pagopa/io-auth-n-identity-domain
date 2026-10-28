// Test for CompressedFiscalCodeSet
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";
import { CompressedFiscalCodeSet } from "../test-login.vo.js";

const fiscalCodeB = "AAAAAA00A00A000B";
const fiscalCodeC = "AAAAAA00A00A000C";

const oneElementList = [fiscalCodeB];
// "AAAAAA00A00A000B"
const oneElementListEncoded =
  "H4sIAAAAAAAA/3IEAwMDCDJwAgAAAP//AQAA//9Tt6vmEAAAAA==";

const twoElementList = [fiscalCodeB, fiscalCodeC];
// "AAAAAA00A00A000B,AAAAAA00A00A000C"
const twoElementListEncoded =
  "H4sIAAAAAAAAE3N0BAEDAwgycNJxRBVwBgBP0wipIQAAAA==";
//"AAAAAA00A00A000B, AAAAAA00A00A000C" (with space after comma)
const twoElementListWithSpaceAfterCommaEncoded =
  "H4sIAAAAAAAAA3N0BAEDAwgycNJRcEQVcQYAvcEOlyIAAAA=";
const twoElementListWithSpaceBeforeCommaEncoded =
  "H4sIAAAAAAAAA3N0BAEDAwgycFLQcUQVcQYA5tDvHiIAAAA=";
//"AAAAAA00A00A000B , AAAAAA00A00A000C" (with space before and after comma)
const twoElementListWithSpacesAroundCommaEncoded =
  "H4sIAAAAAAAAA3N0BAEDAwgycFLQUXBEFXIGAPI9szgjAAAA";

describe("test fixtures", () => {
  it.each`
    encoded                                       | decoded
    ${oneElementListEncoded}                      | ${"AAAAAA00A00A000B"}
    ${twoElementListEncoded}                      | ${"AAAAAA00A00A000B,AAAAAA00A00A000C"}
    ${twoElementListWithSpaceAfterCommaEncoded}   | ${"AAAAAA00A00A000B, AAAAAA00A00A000C"}
    ${twoElementListWithSpaceBeforeCommaEncoded}  | ${"AAAAAA00A00A000B ,AAAAAA00A00A000C"}
    ${twoElementListWithSpacesAroundCommaEncoded} | ${"AAAAAA00A00A000B , AAAAAA00A00A000C"}
  `("decodes to $decoded", ({ encoded, decoded }) => {
    expect(gunzipSync(Buffer.from(encoded, "base64")).toString()).toBe(decoded);
  });
});

describe("CompressedFiscalCodeSet", () => {
  it.each`
    case                                         | input                                         | expected
    ${"empty list"}                              | ${""}                                         | ${new Set()}
    ${"1 element list"}                          | ${oneElementListEncoded}                      | ${new Set(oneElementList)}
    ${"2 element list"}                          | ${twoElementListEncoded}                      | ${new Set(twoElementList)}
    ${"2 element list with space after comma"}   | ${twoElementListWithSpaceAfterCommaEncoded}   | ${new Set(twoElementList)}
    ${"2 element list with space before comma"}  | ${twoElementListWithSpaceBeforeCommaEncoded}  | ${new Set(twoElementList)}
    ${"2 element list with spaces around comma"} | ${twoElementListWithSpacesAroundCommaEncoded} | ${new Set(twoElementList)}
  `("parses $case correctly", async ({ input, expected }) => {
    const result = CompressedFiscalCodeSet.parse(input);
    expect(result).toEqual(expected);
  });
});
