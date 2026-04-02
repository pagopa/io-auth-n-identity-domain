import { describe, it, expect } from "vitest";
import { InvocationContext } from "@azure/functions";
import { isLastTimerTriggerRetry } from "../function-utils";

describe("isLastTimerTriggerRetry", () => {
  describe("Tests for complete retryContext", () => {
    it("should return false if retryCount is less than maxRetryCount", () => {
      const context = {
        retryContext: {
          retryCount: 2,
          maxRetryCount: 3,
        },
      } as unknown as InvocationContext;
      // The retryCount (2) is less than maxRetryCount (3), so it is not the last retry.
      expect(isLastTimerTriggerRetry(context)).toBe(false);
    });

    it("should return true if retryCount equals maxRetryCount", () => {
      const context = {
        retryContext: {
          retryCount: 3,
          maxRetryCount: 3,
        },
      } as unknown as InvocationContext;
      expect(isLastTimerTriggerRetry(context)).toBe(true);
    });
  });

  describe("Tests for undefined or incomplete retryContext", () => {
    it("should return false if retryContext is undefined", () => {
      const context = {} as InvocationContext;
      expect(isLastTimerTriggerRetry(context)).toBe(false);
    });

    it("should return false if retryContext is present but retryCount is undefined", () => {
      const context = {
        retryContext: {
          maxRetryCount: 3,
        },
      } as unknown as InvocationContext;
      expect(isLastTimerTriggerRetry(context)).toBe(false);
    });

    it("should return false if retryContext is present but maxRetryCount is undefined", () => {
      const context = {
        retryContext: {
          retryCount: 3,
        },
      } as unknown as InvocationContext;
      expect(isLastTimerTriggerRetry(context)).toBe(false);
    });
  });
});
