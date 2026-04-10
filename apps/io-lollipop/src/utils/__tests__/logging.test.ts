import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { TelemetryClient } from "applicationinsights";

import { createApplicationInsightsLogger, LogInput } from "../logging";

const mockTrackEvent = vi.fn();
const mockTelemetryClient = {
  trackEvent: mockTrackEvent,
} as unknown as TelemetryClient;

const PREFIX = "test.prefix";

describe("createApplicationInsightsLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const logger = createApplicationInsightsLogger(mockTelemetryClient, PREFIX);

  // ── processLogInput scenarios ──────────────────────────────────────

  describe("LogInput processing", () => {
    it("should handle a plain string LogInput", () => {
      const result = logger.peek.info("static message")("value");

      expect(result).toBe("value");
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "test.prefix.info.global",
        properties: { message: "static message" },
        tagOverrides: { samplingEnabled: "false" },
      });
    });

    it("should handle a tuple [message, meta] LogInput", () => {
      const meta = { name: "myEvent", detail: "extra" };
      logger.peek.info(["a message", meta] as const)("value");

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "test.prefix.info.myevent",
        properties: { message: "a message", detail: "extra" },
        tagOverrides: { samplingEnabled: "false" },
      });
    });

    it("should handle a function LogInput returning a string", () => {
      const fn: LogInput<number> = (n) => `got ${n}`;
      logger.peek.info(fn)(42);

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "test.prefix.info.global",
        properties: { message: "got 42" },
        tagOverrides: { samplingEnabled: "false" },
      });
    });

    it("should handle a function LogInput returning a tuple", () => {
      const fn: LogInput<number> = (n) =>
        [`number is ${n}`, { name: "numEvent", n }] as const;
      logger.peek.info(fn)(7);

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "test.prefix.info.numevent",
        properties: { message: "number is 7", n: 7 },
        tagOverrides: { samplingEnabled: "false" },
      });
    });

    it("should default event name to 'global' when meta has no name", () => {
      const meta = { detail: "no-name" };
      logger.peek.info(["msg", meta] as const)("x");

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.info.global" }),
      );
    });
  });

  // ── peek ───────────────────────────────────────────────────────────

  describe("peek.info", () => {
    it("should return the input value unchanged", () => {
      const result = logger.peek.info("msg")({ a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it("should call trackEvent with level 'info'", () => {
      logger.peek.info("hello")("val");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.info.global" }),
      );
    });
  });

  describe("peek.error", () => {
    it("should return the input value unchanged", () => {
      const result = logger.peek.error("err")("value");
      expect(result).toBe("value");
    });

    it("should call trackEvent with level 'error'", () => {
      logger.peek.error("fail")("val");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.error.global" }),
      );
    });
  });

  // ── taskEither ─────────────────────────────────────────────────────

  describe("taskEither.info", () => {
    it("should log on Right and preserve the value", async () => {
      const te = TE.right("ok");
      const result = await logger.taskEither.info("success")(te)();

      expect(result).toEqual(E.right("ok"));
      expect(mockTrackEvent).toHaveBeenCalledOnce();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.info.global" }),
      );
    });

    it("should NOT log on Left", async () => {
      const te = TE.left("err");
      const result = await logger.taskEither.info("success")(te)();

      expect(result).toEqual(E.left("err"));
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe("taskEither.errorLeft", () => {
    it("should log on Left and preserve the error", async () => {
      const te = TE.left("fail");
      const result = await logger.taskEither.errorLeft("bad")(te)();

      expect(result).toEqual(E.left("fail"));
      expect(mockTrackEvent).toHaveBeenCalledOnce();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.error.global" }),
      );
    });

    it("should NOT log on Right", async () => {
      const te = TE.right("ok");
      const result = await logger.taskEither.errorLeft("bad")(te)();

      expect(result).toEqual(E.right("ok"));
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("should use a function LogInput receiving the Left value", async () => {
      const te = TE.left({ code: 404, msg: "not found" });
      await logger.taskEither.errorLeft(
        (e: { code: number; msg: string }) => `Error ${e.code}: ${e.msg}`,
      )(te)();

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: { message: "Error 404: not found" },
        }),
      );
    });
  });

  // ── either ─────────────────────────────────────────────────────────

  describe("either.errorLeft", () => {
    it("should log on Left and preserve the error", () => {
      const either = E.left("fail");
      const result = logger.either.errorLeft("bad")(either);

      expect(result).toEqual(E.left("fail"));
      expect(mockTrackEvent).toHaveBeenCalledOnce();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.error.global" }),
      );
    });

    it("should NOT log on Right", () => {
      const either = E.right("ok");
      const result = logger.either.errorLeft("bad")(either);

      expect(result).toEqual(E.right("ok"));
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("should use a function LogInput receiving the Left value", () => {
      const either = E.left("oops");
      logger.either.errorLeft(
        (e: string) => [`err: ${e}`, { name: "myErr" }] as const,
      )(either);

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: "test.prefix.error.myerr",
        properties: { message: "err: oops" },
        tagOverrides: { samplingEnabled: "false" },
      });
    });
  });

  // ── event name formatting ──────────────────────────────────────────

  describe("event name formatting", () => {
    it("should lowercase the full event name", () => {
      logger.peek.info(["msg", { name: "MyEvent" }] as const)("x");

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test.prefix.info.myevent" }),
      );
    });

    it("should always set samplingEnabled to 'false'", () => {
      logger.peek.error("x")("y");

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tagOverrides: { samplingEnabled: "false" },
        }),
      );
    });
  });
});
