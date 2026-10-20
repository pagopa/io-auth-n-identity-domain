import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IdpFriendlyNameAdapter,
  IdpFriendlyNameConfigSchema,
} from "../friendly-name.adapter.js";

const ISSUER = "https://idp.example.com";
const FRIENDLY_NAME = "Identity Provider";

const makeAdapter = () =>
  new IdpFriendlyNameAdapter(
    IdpFriendlyNameConfigSchema.parse({
      IDP_FRIENDLY_NAMES_PROD_URL: "https://names.example.com/prod",
      IDP_FRIENDLY_NAMES_UAT_URL: "https://names.example.com/uat",
      IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS: 60,
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
    );
  });
});
