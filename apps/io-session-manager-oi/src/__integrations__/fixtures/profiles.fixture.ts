export const EXISTING_FISCAL_CODE = "ISPXNB32R82Y766Z";

// A fiscal code that is not seeded on the local Cosmos DB emulator, used to
// exercise profile creation.
export const NEW_FISCAL_CODE = "SPNDNL80R13C555X";

export const PROFILE_PARTITION_KEY_PATH = "/fiscalCode";

/**
 * A `RetrievedProfile`-shaped document for `EXISTING_FISCAL_CODE`.
 *
 * `id` follows the `generateVersionedModelId` convention used by
 * `CosmosdbModelVersioned` (`${modelId}-${paddedVersion}`), and `version`
 * is `0`, matching the first revision of a profile.
 */
export const existingProfileDocument = {
  email: "existing-fiscal-code@example.com",
  fiscalCode: EXISTING_FISCAL_CODE,
  id: `${EXISTING_FISCAL_CODE}-0000000000000000`,
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: true,
  isWebhookEnabled: false,
  servicePreferencesSettings: {
    mode: "LEGACY",
    version: -1,
  },
  version: 0,
};
