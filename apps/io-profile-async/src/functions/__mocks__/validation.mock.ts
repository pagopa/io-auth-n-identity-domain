import * as E from "fp-ts/Either";
import { expect } from "vitest";

export const aValidationErrorWithoutValidation = E.left(
  expect.objectContaining({
    message: "Your request parameters didn't validate",
    name: "ValidationError"
  })
);
