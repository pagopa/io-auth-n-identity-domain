import {
  ConflictError,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import fastify, { type FastifyInstance } from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LockUserSessionUseCase } from "../../../../application/use-cases/lock-user-session.use-case.js";
import { mountLockUserSessionHandler } from "../lock-user-session.handler.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const url = `/api/auth/v2/auth/${fiscalCode}/lock`;
const useCase = vi.fn<LockUserSessionUseCase>();
let server: FastifyInstance;

beforeEach(() => {
  useCase.mockReset().mockResolvedValue(ok(undefined));
  server = fastify();
  mountLockUserSessionHandler(server, useCase);
});

afterEach(async () => {
  await server.close();
});

describe("mountLockUserSessionHandler", () => {
  it("creates the lock and returns 204", async () => {
    const response = await server.inject({
      method: "POST",
      url,
      payload: { unlock_code: "012345678" },
    });

    expect(response.statusCode).toBe(204);
    expect(useCase).toHaveBeenCalledExactlyOnceWith({
      fiscalCode,
      unlockCode: "012345678",
    });
  });

  it.each([
    { url, payload: {} },
    { url, payload: { unlock_code: "12" } },
    {
      url: "/api/auth/v2/auth/invalid/lock",
      payload: { unlock_code: "012345678" },
    },
  ])("rejects an invalid request", async ({ url, payload }) => {
    const response = await server.inject({ method: "POST", url, payload });

    expect(response.statusCode).toBe(400);
    expect(useCase).not.toHaveBeenCalled();
  });

  it("returns 409 when the user is already locked", async () => {
    useCase.mockResolvedValueOnce(err(new ConflictError("already locked")));

    const response = await server.inject({
      method: "POST",
      url,
      payload: { unlock_code: "012345678" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("returns 500 when the use case fails", async () => {
    useCase.mockResolvedValueOnce(err(new GenericError("operation failed")));

    const response = await server.inject({
      method: "POST",
      url,
      payload: { unlock_code: "012345678" },
    });

    expect(response.statusCode).toBe(500);
  });
});
