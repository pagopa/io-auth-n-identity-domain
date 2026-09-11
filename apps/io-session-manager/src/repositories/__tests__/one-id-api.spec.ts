import { describe, it, expect, vi, afterEach } from "vitest";
import * as E from "fp-ts/Either";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { getOneIdAPIClient } from "../one-id-api";

const aBaseUrl = "https://localhost/prod";
const anAccessToken = "an-access-token" as NonEmptyString;
const anXmlAssertion = "<saml2p:Response>an assertion</saml2p:Response>";

const mockFetch = vi.fn();

describe("OneIdAPIClient#getSamlAssertion", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return the raw XML assertion when the endpoint responds with a valid application/xml payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => "application/xml",
      },
      text: () => Promise.resolve(anXmlAssertion),
    });

    const client = getOneIdAPIClient(mockFetch as unknown as typeof fetch);
    const result = await client.getSamlAssertion(aBaseUrl, anAccessToken)();

    expect(mockFetch).toHaveBeenCalledWith(
      `${aBaseUrl}/saml/assertion?access_token=${anAccessToken}`,
      {
        method: "GET",
        headers: { Accept: "application/xml" },
      },
    );
    expect(result).toEqual(E.right(anXmlAssertion));
  });

  it("should return an error when the underlying fetch rejects", async () => {
    const aNetworkError = new Error("network error");
    mockFetch.mockRejectedValueOnce(aNetworkError);

    const client = getOneIdAPIClient(mockFetch as unknown as typeof fetch);
    const result = await client.getSamlAssertion(aBaseUrl, anAccessToken)();

    expect(result).toEqual(E.left(aNetworkError));
  });

  it("should return an error when the response status is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: {
        get: () => "application/xml",
      },
    });

    const client = getOneIdAPIClient(mockFetch as unknown as typeof fetch);
    const result = await client.getSamlAssertion(aBaseUrl, anAccessToken)();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toContain("received status 500");
    }
  });

  it("should return an error when the response content-type is not application/xml", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => "application/json",
      },
    });

    const client = getOneIdAPIClient(mockFetch as unknown as typeof fetch);
    const result = await client.getSamlAssertion(aBaseUrl, anAccessToken)();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toContain(
        'expected "application/xml", received "application/json"',
      );
    }
  });

  it("should return an error when the response has no content-type header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => null,
      },
    });

    const client = getOneIdAPIClient(mockFetch as unknown as typeof fetch);
    const result = await client.getSamlAssertion(aBaseUrl, anAccessToken)();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toContain('received ""');
    }
  });
});
