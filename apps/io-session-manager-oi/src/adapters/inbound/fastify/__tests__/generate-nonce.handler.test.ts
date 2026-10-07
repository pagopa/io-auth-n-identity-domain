import { GenericError, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import fastify from "fastify";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { makeGenerateNonceUseCase } from "../../../../application/use-cases/generate-nonce.use-case.js";
import { type FastLoginPort } from "../../../../domain/ports/outbound/fast-login.port.js";
import { mountGenerateNonceHandler } from "../generate-nonce.handler.js";

describe("generate nonce route", () => {
  it("returns a nonce without authentication", async () => {
    const server = fastify();
    const nonce = "870c6d89-a3c4-48b1-a796-cdacddaf94b4";
    const generateNonce = vi.fn().mockResolvedValue(ok(NonEmptyStringSchema.parse(nonce)));
    mountGenerateNonceHandler(
      server,
      makeGenerateNonceUseCase({ generateNonce } as unknown as FastLoginPort),
    );

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/v2/fast-login/nonce/generate",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ nonce });
    expect(generateNonce).toHaveBeenCalledOnce();
    await server.close();
  });

  it("returns a server error when the upstream service fails", async () => {
    const server = fastify();
    mountGenerateNonceHandler(
      server,
      makeGenerateNonceUseCase({
        generateNonce: vi.fn().mockResolvedValue(err(new GenericError("upstream failure"))),
      } as unknown as FastLoginPort),
    );

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/v2/fast-login/nonce/generate",
    });

    expect(response.statusCode).toBe(500);
    await server.close();
  });
});
