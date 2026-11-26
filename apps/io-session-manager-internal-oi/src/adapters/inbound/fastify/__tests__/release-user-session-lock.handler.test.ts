import {
  FiscalCodeSchema,
  ForbiddenError,
  GenericError,
} from "@pagopa/hexagonal-core";
import fastify, { type FastifyInstance } from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReleaseUserSessionLockUseCase } from "../../../../application/use-cases/release-user-session-lock.use-case.js";
import { mountReleaseUserSessionLockHandler } from "../release-user-session-lock.handler.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const url = `/api/auth/v2/auth/${fiscalCode}/release-lock`;
const useCase = vi.fn<ReleaseUserSessionLockUseCase>();
let server: FastifyInstance;

beforeEach(() => {
  useCase.mockReset().mockResolvedValue(ok(undefined));
  server = fastify();
  mountReleaseUserSessionLockHandler(server, useCase);
});

afterEach(async () => {
  await server.close();
});

describe("mountReleaseUserSessionLockHandler", () => {
  it("releases the lock with the unlock code and returns 204", async () => {
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

  it("releases all the locks when the unlock code is omitted", async () => {
    const response = await server.inject({ method: "POST", url, payload: {} });

    expect(response.statusCode).toBe(204);
    expect(useCase).toHaveBeenCalledExactlyOnceWith({
      fiscalCode,
      unlockCode: undefined,
    });
  });

  it("rejects an invalid unlock code", async () => {
    const response = await server.inject({
      method: "POST",
      url,
      payload: { unlock_code: "12" },
    });

    expect(response.statusCode).toBe(400);
    expect(useCase).not.toHaveBeenCalled();
  });

  it("returns 403 when the unlock code does not match", async () => {
    useCase.mockResolvedValueOnce(err(new ForbiddenError()));

    const response = await server.inject({
      method: "POST",
      url,
      payload: { unlock_code: "012345678" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns 500 when the use case fails", async () => {
    useCase.mockResolvedValueOnce(err(new GenericError("operation failed")));

    const response = await server.inject({ method: "POST", url, payload: {} });

    expect(response.statusCode).toBe(500);
  });
});
