import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { agent } from "@pagopa/ts-commons";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IdpFriendlyNameAdapter,
  IdpFriendlyNameConfigSchema,
} from "../friendly-name.adapter.js";

const ISSUER = NonEmptyStringSchema.parse("https://idp.example.com");
const FRIENDLY_NAME = NonEmptyStringSchema.parse("Identity Provider");

const mockFetch = vi.fn<typeof fetch>();

const makeAdapter = () =>
  new IdpFriendlyNameAdapter(
    IdpFriendlyNameConfigSchema.parse({
      IDP_FRIENDLY_NAMES_PROD_URL: "https://names.example.com/prod",
      IDP_FRIENDLY_NAMES_UAT_URL: "https://names.example.com/uat",
      IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS: 60,
      IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS: 1,
    }),
  );

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe("IdpFriendlyNameAdapter#getFriendlyName", () => {
  it("returns the friendly name associated with an issuer", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
        status: 200,
      }),
    );
    vi.spyOn(agent, "getFetch").mockReturnValue(mockFetch);

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result).toBe(FRIENDLY_NAME);
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      new URL("https://names.example.com/prod"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns the issuer when it is not present in the map", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ "https://another-idp.example.com": "Other IdP" }),
        {
          status: 200,
        },
      ),
    );
    vi.spyOn(agent, "getFetch").mockReturnValue(mockFetch);

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result).toBe(ISSUER);
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      new URL("https://names.example.com/prod"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each(["constructor", "__proto__"])(
    "does not use inherited properties for issuer %s",
    async (issuer) => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
          status: 200,
        }),
      );
      vi.spyOn(agent, "getFetch").mockReturnValue(mockFetch);

      const nonEmptyIssuer = NonEmptyStringSchema.parse(issuer);
      const result = await makeAdapter().getFriendlyName(
        nonEmptyIssuer,
        "PROD",
      );

      expect(result).toBe(nonEmptyIssuer);
    },
  );

  it("falls back to the issuer when a friendly name is empty", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ [ISSUER]: "" }), {
        status: 200,
      }),
    );
    vi.spyOn(agent, "getFetch").mockReturnValue(mockFetch);

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result).toBe(ISSUER);
  });

  it("falls back to the issuer when the request times out", async () => {
    mockFetch.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("The request was aborted")),
          );
        }),
    );
    vi.spyOn(agent, "getFetch").mockReturnValue(mockFetch);
    vi.useFakeTimers();

    const resultPromise = makeAdapter().getFriendlyName(ISSUER, "PROD");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(resultPromise).resolves.toBe(ISSUER);
  });
});
