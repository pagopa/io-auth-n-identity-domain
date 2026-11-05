import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IdpFriendlyNameAdapter } from "../friendly-name.adapter.js";
import { IdpFriendlyNameConfigSchema } from "../../../domain/value-objects/configs/friendly-name.vo.js";

const ISSUER = NonEmptyStringSchema.parse("https://idp.example.com");
const FRIENDLY_NAME = NonEmptyStringSchema.parse("Identity Provider");

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IdpFriendlyNameAdapter#getFriendlyName", () => {
  it("returns the friendly name associated with an issuer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
          status: 200,
        }),
      ),
    );

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result._unsafeUnwrap()).toBe(FRIENDLY_NAME);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      new URL("https://names.example.com/prod"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shares an in-flight fetch between concurrent cold-cache requests", async () => {
    let resolveResponse!: (response: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(responsePromise);
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    const resultsPromise = Promise.all([
      adapter.getFriendlyName(ISSUER, "PROD"),
      adapter.getFriendlyName(ISSUER, "PROD"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse(
      new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
        status: 200,
      }),
    );

    const results = await resultsPromise;
    expect(results.map((result) => result._unsafeUnwrap())).toEqual([
      FRIENDLY_NAME,
      FRIENDLY_NAME,
    ]);
  });

  it("shares an in-flight refresh between concurrent expired-cache requests", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let resolveRefreshResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    await adapter.getFriendlyName(ISSUER, "PROD");
    now += 60_001;

    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRefreshResponse = resolve;
        }),
    );
    const resultsPromise = Promise.all([
      adapter.getFriendlyName(ISSUER, "PROD"),
      adapter.getFriendlyName(ISSUER, "PROD"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveRefreshResponse(
      new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
        status: 200,
      }),
    );

    const results = await resultsPromise;
    expect(results.map((result) => result._unsafeUnwrap())).toEqual([
      FRIENDLY_NAME,
      FRIENDLY_NAME,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an error when the issuer is not present in the map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "https://another-idp.example.com": "Other IdP" }),
          {
            status: 200,
          },
        ),
      ),
    );

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result.isErr()).toBe(true);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      new URL("https://names.example.com/prod"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each(["constructor", "__proto__"])(
    "does not use inherited properties for issuer %s",
    async (issuer) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ [ISSUER]: FRIENDLY_NAME }), {
            status: 200,
          }),
        ),
      );

      const nonEmptyIssuer = NonEmptyStringSchema.parse(issuer);
      const result = await makeAdapter().getFriendlyName(
        nonEmptyIssuer,
        "PROD",
      );

      expect(result.isErr()).toBe(true);
    },
  );

  it("returns an error when a friendly name is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ [ISSUER]: "" }), {
          status: 200,
        }),
      ),
    );

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result.isErr()).toBe(true);
  });
});
