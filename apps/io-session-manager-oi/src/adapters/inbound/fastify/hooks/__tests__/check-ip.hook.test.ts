import fastify from "fastify";
import { describe, expect, it } from "vitest";

import { createCheckIpHook } from "../check-ip.hook.js";

const ALLOWED_CIDR = "10.0.0.0/8";
const ALLOWED_IP = "10.1.2.3";
const BLOCKED_IP = "192.168.1.1";

const buildServer = (allowedCIDRs: ReadonlyArray<string>) => {
  const server = fastify({ trustProxy: true });

  server.get(
    "/test",
    { preHandler: createCheckIpHook(allowedCIDRs) },
    async () => ({ ok: true }),
  );

  return server;
};

describe("createCheckIpHook", () => {
  it("allows a request from an IP within the CIDR range", async () => {
    const server = buildServer([ALLOWED_CIDR]);

    const response = await server.inject({
      headers: { "x-forwarded-for": ALLOWED_IP },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("blocks a request from an IP outside the CIDR range with 403", async () => {
    const server = buildServer([ALLOWED_CIDR]);

    const response = await server.inject({
      headers: { "x-forwarded-for": BLOCKED_IP },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      status: 403,
      title: "Forbidden",
    });
  });

  it("falls back to 'x-client-ip' when 'x-forwarded-for' is not a valid IP", async () => {
    const server = buildServer([ALLOWED_CIDR]);

    const response = await server.inject({
      headers: {
        // An invalid value causes Fastify to propagate it as request.ip,
        // which fails IPSchema validation and triggers the x-client-ip fallback.
        "x-forwarded-for": "not-an-ip",
        "x-client-ip": ALLOWED_IP,
      },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
  });

  it("returns 400 when no valid IP can be extracted", async () => {
    const server = buildServer([ALLOWED_CIDR]);

    // With trustProxy: true, an invalid `x-forwarded-for` value is
    // propagated as `request.ip` and fails IPSchema validation. When the
    // `x-client-ip` fallback header is also invalid, `extractIP` returns
    // `undefined` and the hook responds with a ValidationError → 400.
    const response = await server.inject({
      headers: {
        "x-client-ip": "also-not-an-ip",
        "x-forwarded-for": "not-an-ip",
      },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("allows a request matching one of multiple allowed CIDRs", async () => {
    const server = buildServer(["192.168.0.0/16", ALLOWED_CIDR]);

    const response = await server.inject({
      headers: { "x-forwarded-for": "192.168.5.10" },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
  });

  it("blocks a request when the CIDR list is empty", async () => {
    const server = buildServer([]);

    const response = await server.inject({
      headers: { "x-forwarded-for": ALLOWED_IP },
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(403);
  });
});
