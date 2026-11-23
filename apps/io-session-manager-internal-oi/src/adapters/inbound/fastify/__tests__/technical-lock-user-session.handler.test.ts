import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import fastify, { type FastifyInstance } from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  TechnicalLockUserSessionUseCase,
  TechnicalUnlockUserSessionUseCase,
} from "../../../../application/use-cases/technical-lock-user-session.use-case.js";
import {
  mountTechnicalLockUserSessionHandler,
  mountTechnicalUnlockUserSessionHandler,
} from "../technical-lock-user-session.handler.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const lockUserSession = vi.fn<TechnicalLockUserSessionUseCase>();
const unlockUserSession = vi.fn<TechnicalUnlockUserSessionUseCase>();
let server: FastifyInstance | undefined;

const getServer = (): FastifyInstance => {
  if (!server) {
    throw new Error("Fastify server is not initialized");
  }
  return server;
};

beforeEach(() => {
  lockUserSession.mockReset().mockResolvedValue(ok(undefined));
  unlockUserSession.mockReset().mockResolvedValue(ok(undefined));
  server = fastify();
  mountTechnicalLockUserSessionHandler(getServer(), lockUserSession);
  mountTechnicalUnlockUserSessionHandler(getServer(), unlockUserSession);
});

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("technical lock session handlers", () => {
  it("locks a session for a valid fiscal code", async () => {
    const response = await getServer().inject({
      method: "POST",
      url: `/api/auth/v2/sessions/${fiscalCode}/lock`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "ok" });
    expect(lockUserSession).toHaveBeenCalledExactlyOnceWith({ fiscalCode });
  });

  it("unlocks a session for a valid fiscal code", async () => {
    const response = await getServer().inject({
      method: "DELETE",
      url: `/api/auth/v2/sessions/${fiscalCode}/lock`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "ok" });
    expect(unlockUserSession).toHaveBeenCalledExactlyOnceWith({ fiscalCode });
  });

  it.each(["POST", "DELETE"] as const)(
    "rejects an invalid fiscal code for %s",
    async (method) => {
      const response = await getServer().inject({
        method,
        url: "/api/auth/v2/sessions/invalid/lock",
      });

      expect(response.statusCode).toBe(400);
      expect(lockUserSession).not.toHaveBeenCalled();
      expect(unlockUserSession).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["POST", lockUserSession],
    ["DELETE", unlockUserSession],
  ] as const)(
    "returns 500 when the %s use case fails",
    async (method, useCase) => {
      useCase.mockResolvedValueOnce(err(new GenericError("operation failed")));

      const response = await getServer().inject({
        method,
        url: `/api/auth/v2/sessions/${fiscalCode}/lock`,
      });

      expect(response.statusCode).toBe(500);
    },
  );
});
