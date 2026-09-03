import type {
  PlainSessionToken,
  SessionId,
} from "@pagopa/io-auth-n-identity-session";
import {
  PlainSessionTokenSchema,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session";
import { describe, expect, it } from "vitest";
import {
  FieldsQueryParam,
  GetSessionInputDTO,
  GetSessionOutputDTO,
} from "../get-session.dto.js";

describe("GetSessionInputDTO", () => {
  describe("headers", () => {
    it("decodes a Bearer authorization header into its typed tokens", () => {
      const sessionId = SessionIdSchema.parse("aSessionId");
      const sessionToken = PlainSessionTokenSchema.parse("aPlainSessionToken");
      const parsed = GetSessionInputDTO.headers.parse({
        authorization: `Bearer ${sessionId}.${sessionToken}`,
      });
      const typedSessionId: SessionId = parsed.authorization.sessionId;
      const typedSessionToken: PlainSessionToken =
        parsed.authorization.sessionToken;

      expect({
        sessionId: typedSessionId,
        sessionToken: typedSessionToken,
      }).toEqual({
        sessionId,
        sessionToken,
      });
    });

    it.each([
      "aPlainSessionToken",
      "Bearer",
      "Bearer ",
      "Bearer aSessionId",
      "Bearer .aPlainSessionToken",
      "Bearer aSessionId.",
      "Bearer aSessionId.aPlainSessionToken.extra",
      "bearer aPlainSessionToken",
      "Basic aPlainSessionToken",
    ])("rejects an invalid authorization header: %s", (authorization) => {
      expect(
        GetSessionInputDTO.headers.safeParse({ authorization }).success,
      ).toBe(false);
    });
  });
  describe("query", () => {
    const allSessionFields = GetSessionOutputDTO.keyof().options;

    it.each([
      ["(spidLevel,walletToken)", ["spidLevel", "walletToken"]],
      ["(spidLevel, walletToken)", ["spidLevel", "walletToken"]],
      [
        "(spidLevel,expirationDate,lollipopAssertionRef,walletToken,bpdToken,zendeskToken,fimsToken)",
        [
          "spidLevel",
          "expirationDate",
          "lollipopAssertionRef",
          "walletToken",
          "bpdToken",
          "zendeskToken",
          "fimsToken",
        ],
      ],
      [undefined, allSessionFields],
    ])("parses fields %s", (fields, expected) => {
      const parsed = GetSessionInputDTO.query.parse({ fields });
      const typedFields: FieldsQueryParam = parsed.fields;

      expect(typedFields).toEqual(expected);
    });

    it.each([{}, { fields: undefined }])(
      "returns all session fields when fields is not valued: %o",
      (query) => {
        expect(GetSessionInputDTO.query.parse(query).fields).toEqual(
          allSessionFields,
        );
      },
    );

    it.each([
      "",
      "()",
      "( )",
      "spidLevel,walletToken",
      "(,spidLevel)",
      "(spidLevel,)",
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
