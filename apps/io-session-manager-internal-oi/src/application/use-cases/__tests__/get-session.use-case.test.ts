import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import {
  SessionIdSchema,
  type SessionPort,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeGetSessionUseCase } from "../get-session.use-case.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const sessionPort = (
  findActiveSession: SessionPort["findActiveSession"],
): Pick<SessionPort, "findActiveSession"> => ({ findActiveSession });

const activeSession = (loginType: "LV" | "LEGACY", expirationDate: Date) => ({
  fiscalCode,
  loginType,
  sessionId: SessionIdSchema.parse("01J5M8K2W3R7A6B9C0D1E2F3G4"),
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  expirationDate,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("makeGetSessionUseCase", () => {
  it.each(["LV", "LEGACY"] as const)(
    "returns active for a non-expired %s session",
    async (loginType) => {
      vi.useFakeTimers({ now: new Date("2025-01-02T00:00:00.000Z") });
      const findActiveSession = vi
        .fn<SessionPort["findActiveSession"]>()
        .mockResolvedValue(
          ok(activeSession(loginType, new Date("2025-01-03T00:00:00.000Z"))),
        );

      const result = await makeGetSessionUseCase(
        sessionPort(findActiveSession),
      )({ fiscalCode });

      expect(findActiveSession).toHaveBeenCalledWith(fiscalCode);
      expect(result).toEqual(ok({ active: true }));
    },
  );

  it("returns inactive when no active session document exists", async () => {
    const result = await makeGetSessionUseCase(
      sessionPort(
        vi
          .fn<SessionPort["findActiveSession"]>()
          .mockResolvedValue(
            err(new NotFoundError("ActiveSession", "ActiveSession not found")),
          ),
      ),
    )({ fiscalCode });

    expect(result).toEqual(ok({ active: false }));
  });

  it("returns inactive for a session whose expiration date has passed", async () => {
    vi.useFakeTimers({ now: new Date("2025-01-02T00:00:00.000Z") });
    const result = await makeGetSessionUseCase(
      sessionPort(
        vi
          .fn<SessionPort["findActiveSession"]>()
          .mockResolvedValue(
            ok(activeSession("LEGACY", new Date("2025-01-01T23:59:59.999Z"))),
          ),
      ),
    )({ fiscalCode });

    expect(result).toEqual(ok({ active: false }));
  });

  it("returns a technical error instead of treating a read failure as inactivity", async () => {
    const storageError = new GenericError("Cosmos unavailable");
    const result = await makeGetSessionUseCase(
      sessionPort(
        vi
          .fn<SessionPort["findActiveSession"]>()
          .mockResolvedValue(err(storageError)),
      ),
    )({ fiscalCode });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GenericError);
      expect(result.error.message).toContain("Failed to retrieve active session");
      expect(result.error.cause).toBe(storageError);
    }
  });
});
