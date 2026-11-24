import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import fastify, { type FastifyInstance } from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TechnicalLockUserSessionUseCase } from "../../../../application/use-cases/technical-lock-user-session.use-case.js";
import { mountTechnicalLockUserSessionHandler } from "../technical-lock-user-session.handler.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const useCase = vi.fn<TechnicalLockUserSessionUseCase>();
let server: FastifyInstance;

beforeEach(() => {
  useCase.mockReset().mockResolvedValue(ok(undefined));
  server = fastify();
  mountTechnicalLockUserSessionHandler(server, useCase);
});

afterEach(async () => {
  await server.close();
});

describe("mountTechnicalLockUserSessionHandler", () => {
  it("locks a session for a valid fiscal code", async () => {
    const response = await server.inject({
      method: "POST",
      url: `/api/auth/v2/sessions/${fiscalCode}/lock`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "ok" });
    expect(useCase).toHaveBeenCalledExactlyOnceWith({ fiscalCode });
  });

  it("rejects an invalid fiscal code", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/v2/sessions/invalid/lock",
    });

    expect(response.statusCode).toBe(400);
    expect(useCase).not.toHaveBeenCalled();
  });

  it("returns 500 when the use case fails", async () => {
    useCase.mockResolvedValueOnce(err(new GenericError("operation failed")));

    const response = await server.inject({
      method: "POST",
      url: `/api/auth/v2/sessions/${fiscalCode}/lock`,
    });

    expect(response.statusCode).toBe(500);
  });
});
