import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import fastify, { type FastifyInstance } from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GetSessionStateUseCase } from "../../../../application/use-cases/get-session-state.use-case.js";
import { mountGetSessionStateHandler } from "../get-session-state.handler.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const useCase = vi.fn<GetSessionStateUseCase>();
let server: FastifyInstance;

beforeEach(() => {
  useCase.mockReset().mockResolvedValue(
    ok({
      access_enabled: true,
      session_info: { active: false },
    }),
  );
  server = fastify();
  mountGetSessionStateHandler(server, useCase);
});

afterEach(async () => {
  await server.close();
});

describe("mountGetSessionStateHandler", () => {
  it("returns the state for a valid fiscal code", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/api/auth/v2/sessions/${fiscalCode}/state`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      access_enabled: true,
      session_info: { active: false },
    });
    expect(useCase).toHaveBeenCalledExactlyOnceWith({ fiscalCode });
  });

  it("rejects an invalid fiscal code", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/auth/v2/sessions/invalid/state",
    });

    expect(response.statusCode).toBe(400);
    expect(useCase).not.toHaveBeenCalled();
  });

  it("returns 500 when the use case fails", async () => {
    useCase.mockResolvedValueOnce(err(new GenericError("operation failed")));

    const response = await server.inject({
      method: "GET",
      url: `/api/auth/v2/sessions/${fiscalCode}/state`,
    });

    expect(response.statusCode).toBe(500);
  });
});
