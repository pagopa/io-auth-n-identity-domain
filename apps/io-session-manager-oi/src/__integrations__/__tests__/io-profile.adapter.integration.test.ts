import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";

import { createGetProfileAdapter } from "../../adapters/outbound/io-profile.adapter.js";
import { IO_PROFILE_API_KEY, IO_PROFILE_BASE_URL } from "../env.js";

const adapter = createGetProfileAdapter({
  baseUrl: IO_PROFILE_BASE_URL,
  apiKey: IO_PROFILE_API_KEY,
});

// A fiscal code that exists in the local Docker environment
const EXISTING_FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766Z");

// A fiscal code that does not exist
const UNKNOWN_FISCAL_CODE = FiscalCodeSchema.parse("AAAAAA00A00A000A");

describe("io-profile adapter (integration)", () => {
  it("returns ok(UserProfile) for an existing fiscal code", async () => {
    const result = await adapter.getProfile(EXISTING_FISCAL_CODE);

    expect(result.isOk()).toBe(true);

    const profile = result._unsafeUnwrap();
    expect(profile.fiscalCode).toBe(EXISTING_FISCAL_CODE);
    expect(typeof profile.isEmailValidated).toBe("boolean");
  });

  it("returns err(NotFoundError) for an unknown fiscal code", async () => {
    const result = await adapter.getProfile(UNKNOWN_FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // fallisce perchè in locale non viene controllata l'apiKey
  it("returns err(GenericError) when the API key is invalid", async () => {
    const adapterWithBadKey = createGetProfileAdapter({
      baseUrl: IO_PROFILE_BASE_URL,
      apiKey: "invalid-key",
    });

    const result = await adapterWithBadKey.getProfile(EXISTING_FISCAL_CODE);

    console.log("result", result);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });
});
