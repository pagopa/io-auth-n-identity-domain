import { describe, test, expect } from "vitest";

import { decompressFiscalCodeList } from "../login";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import zlib from "zlib";

describe("Config#login", () => {
  test("decode compressed list of fiscal code", async () => {
    const newExpected = [
      "AAAAAA00A00A000B",
      "AAAAAA00A00A000C",
      "ISPXNB32R82Y766D",
    ];

    const newBase64 = zlib.gzipSync(newExpected.join(",")).toString("base64");

    const result = decompressFiscalCodeList(newBase64);
    expect(result).toMatchObject(new Set(newExpected));
  });
});
