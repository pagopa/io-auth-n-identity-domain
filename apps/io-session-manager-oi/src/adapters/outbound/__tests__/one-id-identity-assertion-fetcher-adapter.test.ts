import { GenericError, type NonEmptyString } from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({})),
  getRequestHealthCheck: vi.fn(),
  getSamlAssertion: vi.fn(),
}));

vi.mock("../../../generated/one-identity/client/index.js", () => ({
  createClient: sdkMocks.createClient,
}));

vi.mock("../../../generated/one-identity/index.js", () => ({
  getRequestHealthCheck: sdkMocks.getRequestHealthCheck,
  getSamlAssertion: sdkMocks.getSamlAssertion,
}));

import { OneIdIdentityAssertionFetcherAdapter } from "../one-id-identity-assertion-fetcher-adapter.js";

const PROD_URL = new URL("https://oneid.example.com");
const UAT_URL = new URL("https://uat-oneid.example.com");
const ACCESS_TOKEN = "an-access-token" as NonEmptyString;
const A_VALID_XML = '<Assertion ID="assertion-id" />';

const makeAdapter = (includeUat = true) =>
  new OneIdIdentityAssertionFetcherAdapter({
    ONEID_PROD_ISSUER: PROD_URL,
    ...(includeUat ? { ONEID_UAT_ISSUER: UAT_URL } : {}),
  });

const aResponse = (status: number, xml = A_VALID_XML) => ({
  response: { status },
  data: new Blob([xml], { type: "application/xml" }),
});

beforeEach(() => {
  vi.clearAllMocks();
  sdkMocks.createClient.mockReturnValue({});
  sdkMocks.getRequestHealthCheck.mockResolvedValue({
    response: { status: 200 },
    data: "ok",
  });
  sdkMocks.getSamlAssertion.mockResolvedValue(aResponse(200));
});

describe("OneIdIdentityAssertionFetcherAdapter#healthcheck", () => {
  it.each([200, 204, 299])(
    "accepts successful healthcheck status %s",
    async (status) => {
      sdkMocks.getRequestHealthCheck.mockResolvedValueOnce({
        response: { status },
        data: "ok",
      });
      const adapter = makeAdapter();

      const result = await adapter.healthcheck();

      expect(result.isOk()).toBe(true);
      expect(sdkMocks.getRequestHealthCheck).toHaveBeenCalledExactlyOnceWith({
        client: expect.anything(),
        baseUrl: PROD_URL.href,
        parseAs: "text",
      });
    },
  );

  it.each([undefined, 199, 300, 503])(
    "returns an error for healthcheck status %s",
    async (status) => {
      sdkMocks.getRequestHealthCheck.mockResolvedValueOnce({
        response: status === undefined ? undefined : { status },
        data: "unhealthy",
      });

      const result = await makeAdapter().healthcheck();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual(
        new GenericError(
          `One Identity status check failed, status: ${status ?? "unknown"}`,
        ),
      );
    },
  );

  it("converts thrown healthcheck errors to GenericError", async () => {
    sdkMocks.getRequestHealthCheck.mockRejectedValueOnce(
      new Error("network unavailable"),
    );

    const result = await makeAdapter().healthcheck();

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("One Identity status check failed: network unavailable"),
    );
  });
});

describe("OneIdIdentityAssertionFetcherAdapter#getAssertion", () => {
  it("returns the parsed assertion and raw XML for a configured environment", async () => {
    const adapter = makeAdapter();

    const result = await adapter.getAssertion("UAT", ACCESS_TOKEN);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toMatchObject({
      assertion: { documentElement: { tagName: "Assertion" } },
      rawAssertion: A_VALID_XML,
      assertionRef: "",
      type: "SAML",
    });
    expect(sdkMocks.getSamlAssertion).toHaveBeenCalledExactlyOnceWith({
      client: expect.anything(),
      baseUrl: UAT_URL,
      query: { access_token: ACCESS_TOKEN },
      headers: { Accept: "application/xml" },
    });
  });

  it("returns an error when the requested environment is not configured", async () => {
    const result = await makeAdapter(false).getAssertion("UAT", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError('Missing OIDC configuration for environment "UAT"'),
    );
    expect(sdkMocks.getSamlAssertion).not.toHaveBeenCalled();
  });

  it.each([undefined, 201, 401, 500])(
    "returns an error for assertion response status %s",
    async (status) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce({
        response: status === undefined ? undefined : { status },
        data: new Blob([A_VALID_XML]),
      });

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual(
        new GenericError(
          `Failed to get SAML assertion, status: ${status ?? "unknown"}`,
        ),
      );
    },
  );

  it("returns an error when the successful response has no body", async () => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce({
      response: { status: 200 },
    });

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result.isErr()).toBe(true);
    expect(sdkMocks.getSamlAssertion).toHaveBeenCalledOnce();
  });

  it.each(["", "  \n"])(
    "rejects an assertion without a document root element: %j",
    async (xml) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toEqual(
        new GenericError("SAML assertion document has no root element"),
      );
    },
  );

  it("returns an error when the assertion XML is malformed", async () => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce(
      aResponse(200, "<Assertion>"),
    );

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Failed to parse SAML assertion:",
    );
  });

  it("converts thrown SDK errors to GenericError", async () => {
    sdkMocks.getSamlAssertion.mockRejectedValueOnce(new Error("provider down"));

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("Failed to get SAML assertion: provider down"),
    );
  });

  it("converts response body read errors to GenericError", async () => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce({
      response: { status: 200 },
      data: { text: vi.fn().mockRejectedValue(new Error("body read failed")) },
    });

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("Failed to get SAML assertion: body read failed"),
    );
  });
});
