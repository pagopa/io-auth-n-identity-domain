import { GenericError, type NonEmptyString } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aValidClaims } from "../../../__mocks__/session.mocks.js";
import type { SessionPort } from "../../../domain/ports/outbound/session.port.js";
import {
  type ActivateUserSessionInput,
  makeActivateUserSessionUseCase,
} from "../activate-user-session.use-case.js";

const TOKEN = "a-session-token" as NonEmptyString;

const anInput: ActivateUserSessionInput = {
  fiscalCode: aValidClaims.fiscalNumber,
  name: aValidClaims.name,
  familyName: aValidClaims.familyName,
  spidLevel: aValidClaims.acr,
};

const sessionPort = {
  create: vi.fn<SessionPort["create"]>(),
  check: vi.fn<SessionPort["check"]>(),
} satisfies SessionPort;

const useCase = makeActivateUserSessionUseCase({ sessionPort });

describe("makeActivateUserSessionUseCase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates the web session from the user data and returns its token", async () => {
    sessionPort.create.mockResolvedValueOnce(ok(TOKEN));

    const result = await useCase(anInput);

    expect(result).toEqual(ok(TOKEN));
    expect(sessionPort.create).toHaveBeenCalledExactlyOnceWith({
      name: anInput.name,
      family_name: anInput.familyName,
      fiscal_number: anInput.fiscalCode,
      spid_level: anInput.spidLevel,
    });
  });

  it("propagates the session creation error", async () => {
    const error = new GenericError("cannot sign");
    sessionPort.create.mockResolvedValueOnce(err(error));

    const result = await useCase(anInput);

    expect(result._unsafeUnwrapErr()).toBe(error);
  });
});
