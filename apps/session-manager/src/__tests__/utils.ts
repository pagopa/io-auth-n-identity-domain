import { expect } from "vitest";

export const toExpectedResponse = (response) => ({
  ...response,
  apply: expect.any(Function),
});
