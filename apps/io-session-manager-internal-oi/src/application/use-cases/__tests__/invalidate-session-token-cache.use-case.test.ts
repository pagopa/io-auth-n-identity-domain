import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import type { PlatformInternalPort } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeInvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const findActiveSession = vi.fn<SessionPort["findActiveSession"]>();
const findSessionTokenBySessionId =
  vi.fn<SessionPort["findSessionTokenBySessionId"]>();
const deleteSession = vi.fn<PlatformInternalPort["deleteSession"]>();
const sessionToken = {
  sessionId: "session-id",
  hashedSessionToken: "hashed-token",
} as unknown as NonNullable<
  Awaited<ReturnType<SessionPort["findSessionTokenBySessionId"]>> extends {
    value: infer Value;
  }
    ? Value
    : never
>;
const invalidateCache = makeInvalidateSessionTokenCacheUseCase({
  sessionPort: { findActiveSession, findSessionTokenBySessionId },
  platformInternalPort: { deleteSession },
});

beforeEach(() => {
  vi.resetAllMocks();
  findActiveSession.mockResolvedValue(
    ok({ sessionId: "session-id" } as Awaited<
      ReturnType<SessionPort["findActiveSession"]>
    > extends { value: infer Value }
      ? Value
      : never),
  );
  findSessionTokenBySessionId.mockResolvedValue(ok(sessionToken));
  deleteSession.mockResolvedValue(ok(undefined));
});

describe("makeInvalidateSessionTokenCacheUseCase", () => {
  it("deletes the current session token cache entry", async () => {
    expect(await invalidateCache(fiscalCode)).toEqual(ok(undefined));
    expect(findActiveSession).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(findSessionTokenBySessionId).toHaveBeenCalledExactlyOnceWith(
      "session-id",
    );
    expect(deleteSession).toHaveBeenCalledExactlyOnceWith(
      "session-id.hashed-token",
    );
  });

  it("succeeds when the user has no active session", async () => {
    findActiveSession.mockResolvedValueOnce(err(new NotFoundError("missing")));

    expect(await invalidateCache(fiscalCode)).toEqual(ok(undefined));
    expect(findSessionTokenBySessionId).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("succeeds when the session token is missing", async () => {
    findSessionTokenBySessionId.mockResolvedValueOnce(ok(undefined));

    expect(await invalidateCache(fiscalCode)).toEqual(ok(undefined));
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("maps cache deletion failures to a generic error", async () => {
    deleteSession.mockResolvedValueOnce(err(new GenericError("cache down")));

    const result = await invalidateCache(fiscalCode);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(
        "Failed to invalidate session token cache: Generic error: cache down",
      ),
    );
  });
});
