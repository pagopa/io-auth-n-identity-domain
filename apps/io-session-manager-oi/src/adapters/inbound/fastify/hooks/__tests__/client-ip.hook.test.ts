import fastify from "fastify";
import { describe, expect, it } from "vitest";

import { normalizeClientIpHook } from "../client-ip.hook.js";

const buildServer = () => {
  const server = fastify({ trustProxy: true });

  server.addHook("onRequest", normalizeClientIpHook);
  server.get("/test", async (request) => ({
    xClientIp: request.headers["x-client-ip"] ?? null,
  }));

  return server;
};

describe("normalizeClientIpHook", () => {
  it("injects request.ip into x-client-ip when no IP header is present", async () => {
    const server = buildServer();

    const response = await server.inject({ method: "GET", url: "/test" });

    // Local injection resolves request.ip to loopback.
    expect(response.json()).toEqual({ xClientIp: "127.0.0.1" });
  });

  it("does not overwrite an existing x-client-ip header", async () => {
    const server = buildServer();

    const response = await server.inject({
      headers: { "x-client-ip": "10.1.2.3" },
      method: "GET",
      url: "/test",
    });

    expect(response.json()).toEqual({ xClientIp: "10.1.2.3" });
  });

  it("does not set x-client-ip when x-forwarded-for is present", async () => {
    const server = buildServer();

    const response = await server.inject({
      headers: { "x-forwarded-for": "203.0.113.7" },
      method: "GET",
      url: "/test",
    });

    expect(response.json()).toEqual({ xClientIp: null });
  });
});
