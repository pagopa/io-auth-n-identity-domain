import {
  AuthenticationError,
  FiscalCode,
  GenericError,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VerifiedActiveSession } from "../../../domain/entitites/active-session.entity.js";
import { SessionBlacklistPort } from "../../../domain/ports/outbound/session-blacklist.port.js";
import { SessionPort } from "../../../domain/ports/outbound/session.port.js";
import { PositiveInteger } from "../../../domain/value-objects/positive-integer.vo.js";
import { makeIntrospectionUseCase } from "../introspection.use-case.js";

const aToken = "a-token" as NonEmptyString;
const aVerifiedSession: VerifiedActiveSession = {
  metadata: {
    id: "a-jti" as NonEmptyString,
    expiresAtSeconds: 1000 as PositiveInteger,
  },
  user: {
    name: "Mario" as NonEmptyString,
    family_name: "Rossi" as NonEmptyString,
    fiscal_number: "AAAAAA00A00A000A" as FiscalCode,
    spid_level: "https://www.spid.gov.it/SpidL2",
  },
};

const sessionPort = { create: vi.fn(), check: vi.fn() } satisfies SessionPort;
const sessionBlacklistPort = {
  blacklist: vi.fn(),
  isBlacklisted: vi.fn(),
} satisfies SessionBlacklistPort;

const introspect = makeIntrospectionUseCase({
  sessionPort,
  sessionBlacklistPort,
});

describe("introspection use case", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the user data of a valid, non-blacklisted session", async () => {
    sessionPort.check.mockResolvedValueOnce(ok(aVerifiedSession));
    sessionBlacklistPort.isBlacklisted.mockResolvedValueOnce(ok(false));

    const result = await introspect({ token: aToken });

    expect(result._unsafeUnwrap()).toEqual({
      active: true,
      user: aVerifiedSession.user,
    });
    expect(sessionPort.check).toHaveBeenCalledExactlyOnceWith(aToken);
    expect(sessionBlacklistPort.isBlacklisted).toHaveBeenCalledExactlyOnceWith(
      aVerifiedSession.metadata.id,
    );
  });

  it("propagates the generic error without querying the blacklist", async () => {
    sessionPort.check.mockResolvedValueOnce(err(new GenericError("boom")));

    const result = await introspect({ token: aToken });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(sessionBlacklistPort.isBlacklisted).not.toHaveBeenCalled();
  });

  it("propagates the authentication error without querying the blacklist", async () => {
    sessionPort.check.mockResolvedValueOnce(err(new AuthenticationError()));

    const result = await introspect({ token: aToken });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(sessionBlacklistPort.isBlacklisted).not.toHaveBeenCalled();
  });

  it("returns a ForbiddenError for a blacklisted session", async () => {
    sessionPort.check.mockResolvedValueOnce(ok(aVerifiedSession));
    sessionBlacklistPort.isBlacklisted.mockResolvedValueOnce(ok(true));

    const result = await introspect({ token: aToken });

    expect(result._unsafeUnwrapErr().kind).toBe("ForbiddenError");
  });

  it("propagates blacklist failures", async () => {
    sessionPort.check.mockResolvedValueOnce(ok(aVerifiedSession));
    sessionBlacklistPort.isBlacklisted.mockResolvedValueOnce(
      err(new GenericError("boom")),
    );

    const result = await introspect({ token: aToken });

    expect(result._unsafeUnwrapErr().kind).toBe("GenericError");
  });
});
