import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { beforeAll, describe, expect, it } from "vitest";

import { createIoProfileAdapter } from "../../adapters/outbound/io-profile.adapter.js";
import {
  ENVIRONMENT,
  IO_PROFILE_API_KEY,
  IO_PROFILE_BASE_URL,
} from "../env.js";
import { seedCosmosDb } from "../fixtures/cosmos-seed.js";
import { EXISTING_FISCAL_CODE as EXISTING_FISCAL_CODE_FIXTURE } from "../fixtures/profiles.fixture.js";

const adapter = createIoProfileAdapter({
  baseUrl: IO_PROFILE_BASE_URL,
  apiKey: IO_PROFILE_API_KEY,
});

// A fiscal code that exists in the local Docker environment
const EXISTING_FISCAL_CODE = FiscalCodeSchema.parse(
  EXISTING_FISCAL_CODE_FIXTURE,
);

// A fiscal code that does not exist
const UNKNOWN_FISCAL_CODE = FiscalCodeSchema.parse("ZAAAAA00A00A000Z");

describe("io-profile adapter (integration)", () => {
  // Create the database, the `profiles` container and seed
  // `EXISTING_FISCAL_CODE` on the local Cosmos DB emulator before running
  // any test in this suite.
  beforeAll(async () => {
    await seedCosmosDb();
  });

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

  // this may fail in local environment because api key is not checked
  it("returns err(GenericError) when the API key is invalid", async () => {
    if (ENVIRONMENT == "DEV") {
      return;
    }
    const adapterWithBadKey = createIoProfileAdapter({
      baseUrl: IO_PROFILE_BASE_URL,
      apiKey: "invalid-key",
    });

    const result = await adapterWithBadKey.getProfile(EXISTING_FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });
});
