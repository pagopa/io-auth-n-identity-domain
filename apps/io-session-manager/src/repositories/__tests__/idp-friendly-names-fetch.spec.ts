import { describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/Either";
import { IDP_FRIENDLY_NAMES_URLS } from "../../config/idp-friendly-names";
import { OidcConfigurationEnvEnum } from "../../generated/backend/OidcConfigurationEnv";
import { fetchIdpFriendlyNameList } from "../idp-friendly-names-fetch";

const aProdList = {
  "https://posteid.poste.it": "Poste ID",
  "https://loginspid.aruba.it": "Aruba ID",
};
const aUatList = {
  "https://collaudo.idserver.servizicie.interno.gov.it/idp/profile/SAML2/POST/SSO":
    "CIE ID collaudo",
};

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe("fetchIdpFriendlyNameList", () => {
  it("should fetch the PROD assets URL", async () => {
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse(aProdList));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.PROD,
      fetchApi,
    );

    expect(fetchApi).toHaveBeenCalledExactlyOnceWith(
      IDP_FRIENDLY_NAMES_URLS.PROD,
    );
    expect(result).toEqual(E.right(aProdList));
  });

  it("should fetch the UAT assets URL", async () => {
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse(aUatList));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.UAT,
      fetchApi,
    );

    expect(fetchApi).toHaveBeenCalledExactlyOnceWith(
      IDP_FRIENDLY_NAMES_URLS.UAT,
    );
    expect(result).toEqual(E.right(aUatList));
  });

  it("should decode an arbitrary string-string record", async () => {
    const unexpectedList = { foo: "bar", "https://unknown.example": "X ID" };
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse(unexpectedList));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.PROD,
      fetchApi,
    );

    expect(result).toEqual(E.right(unexpectedList));
  });

  it("should reject payloads with non-string values", async () => {
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse({ posteid: 1 }));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.PROD,
      fetchApi,
    );

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.message).toContain(
        "Invalid IDP friendly names payload",
      );
    }
  });

  it("should reject non-object payloads", async () => {
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse(["posteid"]));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.PROD,
      fetchApi,
    );

    expect(E.isLeft(result)).toBe(true);
  });

  it("should return Left when the HTTP status is not ok", async () => {
    const fetchApi = vi.fn().mockResolvedValue(jsonResponse({}, 500));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.PROD,
      fetchApi,
    );

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.message).toContain("status 500");
    }
  });

  it("should return Left when fetch throws", async () => {
    const fetchApi = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await fetchIdpFriendlyNameList(
      OidcConfigurationEnvEnum.PROD,
      fetchApi,
    );

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.message).toBe("network down");
    }
  });
});
