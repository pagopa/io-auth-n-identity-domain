import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import {
  SessionIdSchema,
  type SessionPort,
} from "@pagopa/io-auth-n-identity-session";
import type { TechnicalLockedProfilesPort } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeGetSessionStateUseCase } from "../get-session-state.use-case.js";
import { LoginType } from "../../../../../../packages/io-auth-n-identity-session/src/index.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const activeSession = (loginType: LoginType, expirationDate: Date) => ({
  fiscalCode,
  loginType,
  sessionId: SessionIdSchema.parse("01J5M8K2W3R7A6B9C0D1E2F3G4"),
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  expirationDate,
});

const createUseCase = (
  findActiveSession: SessionPort["findActiveSession"],
  isLocked: TechnicalLockedProfilesPort["isLocked"],
) =>
  makeGetSessionStateUseCase({
    sessionPort: { findActiveSession },
    technicalLockedProfilesPort: { isLocked },
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("makeGetSessionStateUseCase", () => {
  it("returns an active session and disables access for a locked user", async () => {
    vi.useFakeTimers({ now: new Date("2025-01-02T00:00:00.000Z") });
    const findActiveSession = vi
      .fn<SessionPort["findActiveSession"]>()
      .mockResolvedValue(
        ok(activeSession("LV", new Date("2025-01-03T00:00:00.000Z"))),
      );
    const isLocked = vi
      .fn<TechnicalLockedProfilesPort["isLocked"]>()
      .mockResolvedValue(ok(true));

    const result = await createUseCase(
      findActiveSession,
      isLocked,
    )({
      fiscalCode,
    });

    expect(findActiveSession).toHaveBeenCalledWith(fiscalCode);
    expect(isLocked).toHaveBeenCalledWith(fiscalCode);
    expect(result).toEqual(
      ok({
        access_enabled: false,
        session_info: {
          active: true,
          expiration_date: "2025-01-03T00:00:00.000Z",
          type: "LV",
        },
      }),
    );
  });

  it("returns an inactive session when no active session exists", async () => {
    const result = await createUseCase(
      vi
        .fn<SessionPort["findActiveSession"]>()
        .mockResolvedValue(
          err(new NotFoundError("ActiveSession", "ActiveSession not found")),
        ),
      vi
        .fn<TechnicalLockedProfilesPort["isLocked"]>()
        .mockResolvedValue(ok(false)),
    )({ fiscalCode });

    expect(result).toEqual(
      ok({
        access_enabled: true,
        session_info: { active: false },
      }),
    );
  });

  it("returns an inactive session when the session has expired", async () => {
    vi.useFakeTimers({ now: new Date("2025-01-02T00:00:00.000Z") });
    const result = await createUseCase(
      vi
        .fn<SessionPort["findActiveSession"]>()
        .mockResolvedValue(
          ok(activeSession("LEGACY", new Date("2025-01-01T23:59:59.999Z"))),
        ),
      vi
        .fn<TechnicalLockedProfilesPort["isLocked"]>()
        .mockResolvedValue(ok(false)),
    )({ fiscalCode });

    expect(result).toEqual(
      ok({
        access_enabled: true,
        session_info: { active: false },
      }),
    );
  });

  it("returns an error when checking the lock fails", async () => {
    const storageError = new GenericError("Table storage unavailable");
    const result = await createUseCase(
      vi
        .fn<SessionPort["findActiveSession"]>()
        .mockResolvedValue(
          err(new NotFoundError("ActiveSession", "ActiveSession not found")),
        ),
      vi
        .fn<TechnicalLockedProfilesPort["isLocked"]>()
        .mockResolvedValue(err(storageError)),
    )({ fiscalCode });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GenericError);
      expect(result.error.message).toContain(
        "Failed to retrieve user access status",
      );
      expect(result.error.cause).toBe(storageError);
    }
  });

  it("returns an error when reading the session fails", async () => {
    const storageError = new GenericError("Cosmos unavailable");
    const result = await createUseCase(
      vi
        .fn<SessionPort["findActiveSession"]>()
        .mockResolvedValue(err(storageError)),
      vi
        .fn<TechnicalLockedProfilesPort["isLocked"]>()
        .mockResolvedValue(ok(false)),
    )({ fiscalCode });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GenericError);
      expect(result.error.message).toContain(
        "Failed to retrieve active session",
      );
      expect(result.error.cause).toBe(storageError);
    }
  });
});
