import { ValidationError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { extractIpMiddleware } from "../extract-ip.middleware.js";

const invoke = (headers: unknown) =>
  extractIpMiddleware({ context: {}, payload: { headers } });

describe("extractIpMiddleware", () => {
  it("returns ok(ipAddress) for a valid IPv4 header", async () => {
    const result = await invoke({ "x-forwarded-for": "203.0.113.7" });

    expect(result).toEqual(ok({ ipAddress: "203.0.113.7" }));
  });

  it("returns ok(ipAddress) for a valid IPv6 header", async () => {
    const result = await invoke({ "x-forwarded-for": "2001:db8::1" });

    expect(result).toEqual(ok({ ipAddress: "2001:db8::1" }));
  });

  it("takes the first entry from a comma-separated list", async () => {
    const result = await invoke({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
    });

    expect(result).toEqual(ok({ ipAddress: "203.0.113.7" }));
  });

  it("falls back to x-client-ip when x-forwarded-for is absent", async () => {
    const result = await invoke({ "x-client-ip": "198.51.100.4" });

    expect(result).toEqual(ok({ ipAddress: "198.51.100.4" }));
  });

  it("prefers x-forwarded-for over x-client-ip", async () => {
    const result = await invoke({
      "x-forwarded-for": "203.0.113.7",
      "x-client-ip": "198.51.100.4",
    });

    expect(result).toEqual(ok({ ipAddress: "203.0.113.7" }));
  });

  it("returns err(ValidationError) when both IP headers are missing", async () => {
    const result = await invoke({});

    expect(result).toEqual(
      err(new ValidationError("Missing or invalid client IP address.")),
    );
  });

  it("returns err(ValidationError) when the header is not a valid IP", async () => {
    const result = await invoke({ "x-forwarded-for": "not-an-ip" });

    expect(result).toEqual(
      err(new ValidationError("Missing or invalid client IP address.")),
    );
  });
});
