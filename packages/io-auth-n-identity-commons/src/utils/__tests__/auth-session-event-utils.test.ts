import { Errors } from "io-ts";
import { describe, expect, it } from "vitest";
import { validationErrorsContainsKnownEventType } from "../auth-session-event-utils";
import { EventTypeEnum } from "../../types/session-events/event-type";

describe("AuthSessionEvent utils tests", () => {
  it("should return true in case of known eventType", () => {
    const aValidationError = [
      {
        context: [
          {
            actual: { eventType: EventTypeEnum.LOGIN },
          },
        ],
      },
    ] as unknown as Errors;

    const result = validationErrorsContainsKnownEventType(aValidationError);
    expect(result).toBe(true);
  });

  it("should return false in case of unknown eventType", () => {
    const aValidationError = [
      {
        context: [
          {
            actual: { eventType: "unknonw" },
          },
        ],
      },
    ] as unknown as Errors;

    const result = validationErrorsContainsKnownEventType(aValidationError);
    expect(result).toBe(false);
  });

  it("should return false in case of no eventType is found in validationError", () => {
    const aValidationError = [
      {
        context: [
          {
            actual: { otherProp: "value" },
          },
        ],
      },
    ] as unknown as Errors;

    const result = validationErrorsContainsKnownEventType(aValidationError);
    expect(result).toBe(false);
  });
});
