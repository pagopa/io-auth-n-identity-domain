import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IdpFriendlyNameAdapter,
  IdpFriendlyNameConfigSchema,
} from "../friendly-name.adapter.js";

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

    expect(result).toBe(FRIENDLY_NAME);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      new URL("https://names.example.com/prod"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns the issuer when it is not present in the map", async () => {
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

    expect(result).toBe(ISSUER);
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

      expect(result).toBe(nonEmptyIssuer);
    },
  );

  it("falls back to the issuer when a friendly name is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ [ISSUER]: "" }), {
          status: 200,
        }),
      ),
    );

    const result = await makeAdapter().getFriendlyName(ISSUER, "PROD");

    expect(result).toBe(ISSUER);
  });
});
