/**
 * Fixtures for the `LockedProfilesDataTableAdapter` integration test.
 *
 * The integration suite provisions its own table on Azurite, seeds a couple
 * of rows to represent an active lock and a released lock, and exercises the
 * adapter against them.
 */

// A fiscal code with an active authentication lock (no `Released` field).
export const LOCKED_FISCAL_CODE = "ISPXNB32R82Y766L";

// A fiscal code that used to be locked but has since been released
// (`Released === true`).
export const RELEASED_FISCAL_CODE = "ISPXNB32R82Y766R";

// A fiscal code that never had a lock — no row exists for it.
export const UNKNOWN_FISCAL_CODE = "ZAAAAA00A00A000Z";

/**
 * 9-digit `rowKey` used for the seeded lock rows. Matches the schema
 * constraint enforced by the adapter (`/^\d{9}$/`).
 */
export const LOCK_ID = "123456789";

/**
 * Table names must be alphanumeric and start with a letter. Include a
 * timestamp + random suffix so parallel CI jobs (or reruns) never collide.
 */
export const uniqueLockedProfilesTableName = (): string =>
  `lockedprofilesit${Date.now()}${Math.floor(Math.random() * 1_000)}`;
