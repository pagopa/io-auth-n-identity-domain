import fastify from "fastify";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import {
  ForbiddenError,
  GenericError,
  ValidationError,
} from "@pagopa/io-core-domain/errors";

import type { LcParams } from "../../../../../domain/entities/lollipop.js";
import type { GetLcParams } from "../../../../../domain/ports/lollipop-consumer.port.js";
import { createLollipopHook } from "../lollipop.hook.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_SIGNATURE = "sig1=:AAAA=:";
const VALID_SIGNATURE_INPUT = 'sig1=("@method");nonce="test-nonce"';
const VALID_METHOD = "GET";
const VALID_URL = "https://example.com/api/resource";

const validLollipopHeaders = {
  signature: VALID_SIGNATURE,
  "signature-input": VALID_SIGNATURE_INPUT,
  "x-pagopa-lollipop-original-method": VALID_METHOD,
  "x-pagopa-lollipop-original-url": VALID_URL,
};

const aLcParams: LcParams = {
  assertion_ref: "sha256-abc123",
  assertion_type: "SAML",
  fiscal_code: "RSSMRA85M01H501U",
  lc_authentication_bearer: "eyJhbGciOiJSUzI1NiJ9.test.sig",
  pub_key: "eyJrdHkiOiJFQyJ9",
};

const buildServer = (getLcParams: GetLcParams) => {
  const server = fastify();

  server.get(
    "/test",
    { preHandler: createLollipopHook(getLcParams) },
    async (request) => ({
      assertionRef: request.lollipopContext?.lcParams.assertion_ref,
      ok: true,
    }),
  );

  return server;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createLollipopHook", () => {
  it("stores lollipop context on the request when headers are valid and LC params resolve", async () => {
    const getLcParams: GetLcParams = vi.fn().mockResolvedValue(ok(aLcParams));
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: validLollipopHeaders,
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      assertionRef: aLcParams.assertion_ref,
      ok: true,
    });
    expect(getLcParams).toHaveBeenCalledWith(validLollipopHeaders, undefined);
  });

  it("returns 400 when required lollipop headers are missing", async () => {
    const getLcParams: GetLcParams = vi.fn();
    const server = buildServer(getLcParams);

    const response = await server.inject({
      // no lollipop headers
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      status: 400,
      title: "Validation Error",
    });
    expect(getLcParams).not.toHaveBeenCalled();
  });

  it("returns 400 when the signature header has an invalid format", async () => {
    const getLcParams: GetLcParams = vi.fn();
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: {
        ...validLollipopHeaders,
        signature: "not-a-valid-signature",
      },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(400);
    expect(getLcParams).not.toHaveBeenCalled();
  });

  it("returns 400 when the original URL is not HTTPS", async () => {
    const getLcParams: GetLcParams = vi.fn();
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: {
        ...validLollipopHeaders,
        "x-pagopa-lollipop-original-url": "http://example.com/api",
      },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(400);
    expect(getLcParams).not.toHaveBeenCalled();
  });

  it("returns 403 when the LC params port returns ForbiddenError", async () => {
    const getLcParams: GetLcParams = vi
      .fn()
      .mockResolvedValue(err(new ForbiddenError()));
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: validLollipopHeaders,
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({ status: 403, title: "Forbidden" });
  });

  it("returns 500 when the LC params port returns a GenericError", async () => {
    const getLcParams: GetLcParams = vi
      .fn()
      .mockResolvedValue(err(new GenericError("upstream timeout")));
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: validLollipopHeaders,
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ status: 500 });
  });

  it("passes the fiscal code extracted by getFiscalCode to the port", async () => {
    const getLcParams: GetLcParams = vi.fn().mockResolvedValue(ok(aLcParams));
    const server = fastify();

    server.get(
      "/test",
      {
        preHandler: createLollipopHook(
          getLcParams,
          // stub: always returns a fixed fiscal code
          () =>
            "RSSMRA85M01H501U" as Parameters<
              typeof createLollipopHook
            >[1] extends ((r: unknown) => infer FC) | undefined
              ? FC
              : never,
        ),
      },
      async () => ({ ok: true }),
    );

    await server.inject({
      headers: validLollipopHeaders,
      method: "GET",
      url: "/test",
    });

    expect(getLcParams).toHaveBeenCalledWith(
      validLollipopHeaders,
      "RSSMRA85M01H501U",
    );
  });

  it("accepts an optional content-digest header alongside the required ones", async () => {
    const getLcParams: GetLcParams = vi.fn().mockResolvedValue(ok(aLcParams));
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: {
        ...validLollipopHeaders,
        "content-digest":
          "sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:",
      },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
  });

  it("returns 400 when content-digest has an invalid format", async () => {
    const getLcParams: GetLcParams = vi.fn();
    const server = buildServer(getLcParams);

    const response = await server.inject({
      headers: {
        ...validLollipopHeaders,
        "content-digest": "invalid-digest",
      },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(400);
    expect(getLcParams).not.toHaveBeenCalled();
  });
});
