import { describe, expect, it } from "vitest";
import {
  FieldsQueryParam,
  GetSessionInputDTO,
  GetSessionOutputDTO,
} from "../get-session.dto.js";

describe("GetSessionInputDTO", () => {
  describe("query", () => {
    const allSessionFields = GetSessionOutputDTO.keyof().options;

    it.each([
      ["(spidLevel,walletToken)", new Set(["spidLevel", "walletToken"])],
      ["(spidLevel, walletToken)", new Set(["spidLevel", "walletToken"])],
      [
        "(spidLevel,walletToken,spidLevel)",
        new Set(["spidLevel", "walletToken"]),
      ],
      [
        "(spidLevel,expirationDate,lollipopAssertionRef,walletToken,bpdToken,zendeskToken,fimsToken)",
        new Set([
          "spidLevel",
          "expirationDate",
          "lollipopAssertionRef",
          "walletToken",
          "bpdToken",
          "zendeskToken",
          "fimsToken",
        ]),
      ],
      [undefined, new Set(allSessionFields)],
    ])("parses fields %s", (fields, expected) => {
      const parsed = GetSessionInputDTO.query.parse({ fields });
      const typedFields: FieldsQueryParam = parsed.fields;

      expect(typedFields).toEqual(expected);
    });

    it.each([{}, { fields: undefined }])(
      "returns all session fields when fields is not valued: %o",
      (query) => {
        expect(GetSessionInputDTO.query.parse(query).fields).toEqual(
          new Set(allSessionFields),
        );
      },
    );

    it.each([
      "",
      "()",
      "( )",
      "(, )",
      "spidLevel,walletToken",
      " (spidLevel)",
      "(spidLevel) ",
      " (spidLevel) ",
      "(,spidLevel)",
      "(spidLevel,)",
      "(spidLevel, )",
      "(spidLevel,,walletToken)",
      "(spidLevel.walletToken)",
      "(rootField(nestedField))",
      "(unknownField)",
    ])("rejects malformed fields %s", (fields) => {
      expect(GetSessionInputDTO.query.safeParse({ fields }).success).toBe(
        false,
      );
    });
  });
});
