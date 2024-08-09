import { describe, test, expect } from "vitest";
import { getNewToken } from "../token";

const aTokenLengthBytes = 48;
const aTokenLengthString = aTokenLengthBytes * 2; // because bytes

describe("TokenService#getNewToken", () => {
  test("generate a new token", () => {
    const newToken = getNewToken(aTokenLengthBytes);

    expect(newToken).toHaveLength(aTokenLengthString);
  });
});
