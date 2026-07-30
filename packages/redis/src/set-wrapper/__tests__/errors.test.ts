import {
  AuthenticationError,
  ForbiddenError,
  GatewayTimeoutError,
  GenericError,
  ServiceUnavailableError,
} from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";

import { toRedisError } from "../errors.js";


const buildRedisError = (name: string, message: string): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const GENERIC = "Generic error: ";
const SERVICE_UNAVAILABLE = "Service unavailable: ";
const GATEWAY_TIMEOUT = "Gateway timeout: ";
const AUTH_MESSAGE = "Unauthorized: authentication required";
const FORBIDDEN_MESSAGE =
  "Forbidden: you don't have permission to access this resource";

describe("toRedisError", () => {
  describe("non-Error causes", () => {
    it("wraps a plain string cause in GenericError", () => {
      const result = toRedisError("op", "something went wrong");
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(`${GENERIC}op failed: something went wrong`);
    });

    it("wraps undefined in GenericError", () => {
      const result = toRedisError("op", undefined);
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(`${GENERIC}op failed: undefined`);
    });

    it("wraps a plain object in GenericError", () => {
      const result = toRedisError("op", { some: "thing" });
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(`${GENERIC}op failed: [object Object]`);
    });
  });

  describe("connection-lifecycle errors → ServiceUnavailableError", () => {
    it.each([
      "ClientClosedError",
      "ClientOfflineError",
      "DisconnectsClientError",
      "SocketClosedUnexpectedlyError",
    ])("maps '%s' to ServiceUnavailableError", (name) => {
      const result = toRedisError("op", buildRedisError(name, "closed"));
      expect(result).toBeInstanceOf(ServiceUnavailableError);
      expect(result.message).toBe(
        `${SERVICE_UNAVAILABLE}op failed (${name}): closed`,
      );
    });
  });

  describe("timeout errors → GatewayTimeoutError", () => {
    it.each(["ConnectionTimeoutError", "TimeoutError"])(
      "maps '%s' to GatewayTimeoutError",
      (name) => {
        const result = toRedisError("op", buildRedisError(name, "timed out"));
        expect(result).toBeInstanceOf(GatewayTimeoutError);
        expect(result.message).toBe(
          `${GATEWAY_TIMEOUT}op failed (${name}): timed out`,
        );
      },
    );
  });

  describe("server -ERR replies (ErrorReply / SimpleError)", () => {
    it.each([
      "NOAUTH Authentication required.",
      "WRONGPASS invalid username-password pair or user is disabled.",
    ])(
      "maps '%s' to AuthenticationError (hexagonal fixed message)",
      (message) => {
        const result = toRedisError(
          "op",
          buildRedisError("ErrorReply", message),
        );
        expect(result).toBeInstanceOf(AuthenticationError);
        expect(result.message).toBe(AUTH_MESSAGE);
      },
    );

    it("maps 'NOPERM ...' to ForbiddenError (hexagonal fixed message)", () => {
      const result = toRedisError(
        "op",
        buildRedisError("ErrorReply", "NOPERM this user has no permissions"),
      );
      expect(result).toBeInstanceOf(ForbiddenError);
      expect(result.message).toBe(FORBIDDEN_MESSAGE);
    });

    it.each(["BUSY", "CLUSTERDOWN", "LOADING", "MASTERDOWN", "TRYAGAIN"])(
      "maps '%s ...' transient reply to ServiceUnavailableError",
      (prefix) => {
        const result = toRedisError(
          "op",
          buildRedisError("ErrorReply", `${prefix} something transient`),
        );
        expect(result).toBeInstanceOf(ServiceUnavailableError);
        expect(result.message).toBe(
          `${SERVICE_UNAVAILABLE}op failed (ErrorReply): ${prefix} something transient`,
        );
      },
    );

    it("maps 'WRONGTYPE ...' to GenericError (bug, not transient)", () => {
      const result = toRedisError(
        "op",
        buildRedisError(
          "ErrorReply",
          "WRONGTYPE Operation against a key holding the wrong kind of value",
        ),
      );
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(
        `${GENERIC}op failed (ErrorReply): WRONGTYPE Operation against a key holding the wrong kind of value`,
      );
    });

    it("also classifies auth replies when the name isn't ErrorReply", () => {
      const result = toRedisError(
        "op",
        buildRedisError("Error", "NOAUTH Authentication required."),
      );
      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe(AUTH_MESSAGE);
    });

    it("classifies SimpleError legacy reply names", () => {
      const result = toRedisError(
        "op",
        buildRedisError("SimpleError", "unknown command 'FOO'"),
      );
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(
        `${GENERIC}op failed (SimpleError): unknown command 'FOO'`,
      );
    });
  });

  describe("unrecognised Errors → GenericError", () => {
    it("falls through to GenericError", () => {
      const result = toRedisError("op", new Error("something odd"));
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(`${GENERIC}op failed (Error): something odd`);
    });

    it("appends the `cause` chain when present as an Error", () => {
      const inner = new Error("root cause");
      const outer = new Error("outer");
      (outer as Error & { cause?: unknown }).cause = inner;

      const result = toRedisError("op", outer);
      expect(result).toBeInstanceOf(GenericError);
      expect(result.message).toBe(
        `${GENERIC}op failed (Error): outer Caused by: root cause`,
      );
    });

    it("appends the `cause` chain when present as a plain object", () => {
      const outer = new Error("outer");
      (outer as Error & { cause?: unknown }).cause = { code: "ECONNREFUSED" };

      const result = toRedisError("op", outer);
      expect(result.message).toBe(
        `${GENERIC}op failed (Error): outer Caused by: {"code":"ECONNREFUSED"}`,
      );
    });

    it("appends the `cause` chain when present as a primitive", () => {
      const outer = new Error("outer");
      (outer as Error & { cause?: unknown }).cause = 42;

      const result = toRedisError("op", outer);
      expect(result.message).toBe(
        `${GENERIC}op failed (Error): outer Caused by: 42`,
      );
    });
  });

  it("includes the operation label verbatim in the error message", () => {
    const result = toRedisError(
      "SADD BLOCKEDUSERS",
      buildRedisError("Error", "network unreachable"),
    );
    expect(result.message).toBe(
      `${GENERIC}SADD BLOCKEDUSERS failed (Error): network unreachable`,
    );
  });
});
