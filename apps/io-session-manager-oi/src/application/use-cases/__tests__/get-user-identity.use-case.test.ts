import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import {
  aBaseSession,
  aFiscalCode,
  aGenericError,
  aNotFoundError,
} from "../../../__mocks__/session.mocks.js";
import { makeGetUserIdentityUseCase } from "../get-user-identity.use-case.js";

const now = new Date("2024-01-01T00:00:00Z");
const ttlSeconds = 3600;
const aSession = {
  ...aBaseSession,
  createdAt: new Date("2023-12-31T00:00:00Z"),
  expirationDate: new Date(now.getTime() + ttlSeconds * 1000),
};
const aLollipopActivation = {
  fiscalCode: aFiscalCode,
  assertionRef: `sha256-${"a".repeat(43)}`,
  expirationDate: new Date("2100-01-01"),
};

const getUserIdentity = makeGetUserIdentityUseCase({
  lollipopActivationPort: lollipopActivationPortMock,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("makeGetUserIdentityUseCase", () => {
  it("should return the user identity with the assertion ref and the remaining TTL", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      ok(aLollipopActivation),
    );

    const result = await getUserIdentity({ session: aSession });

    expect(result._unsafeUnwrap()).toEqual({
      familyName: aSession.familyName,
      fiscalCode: aSession.fiscalCode,
      assertionRef: aLollipopActivation.assertionRef,
      name: aSession.name,
      dateOfBirth: aSession.dateOfBirth,
      spidEmail: aSession.spidEmail,
      spidLevel: aSession.spidLevel,
      createdAt: aSession.createdAt,
      tokenRemainingTtl: ttlSeconds,
      sessionId: aSession.sessionId,
      identityProvider: aSession.identityProvider,
    });
    expect(lollipopActivationPortMock.getByFiscalCode).toHaveBeenCalledWith(
      aSession.fiscalCode,
    );
  });

  it("should round down the remaining TTL to whole seconds", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      ok(aLollipopActivation),
    );

    const result = await getUserIdentity({
      session: {
        ...aSession,
        expirationDate: new Date(now.getTime() + 1999),
      },
    });

    expect(result._unsafeUnwrap().tokenRemainingTtl).toBe(1);
  });

  it.each([
    { title: "fails", error: aGenericError },
    { title: "is not found", error: aNotFoundError },
  ])(
    "should return an error when the lollipop activation retrieval $title",
    async ({ error }) => {
      lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
        err(error),
      );

      const result = await getUserIdentity({ session: aSession });

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    },
  );

  it.each([
    { title: "expired", offsetMs: -1000 },
    { title: "expiring right now", offsetMs: 0 },
  ])(
    "should return an error when the session is $title",
    async ({ offsetMs }) => {
      const result = await getUserIdentity({
        session: {
          ...aSession,
          expirationDate: new Date(now.getTime() + offsetMs),
        },
      });

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
      expect(lollipopActivationPortMock.getByFiscalCode).not.toHaveBeenCalled();
    },
  );
});
