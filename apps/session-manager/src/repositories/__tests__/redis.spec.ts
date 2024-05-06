import { describe, test, expect } from "vitest";
import { obfuscateTokensInfo } from "../redis";
import { getNewToken } from "../../services/token";
import { SESSION_TOKEN_LENGTH_BYTES } from "../../controllers/session";

const getAnErrorMessage = (token: string) =>
  `{"code":"UNCERTAIN_STATE","command":"MGET","args":["${token}"],"origin":{"errno":-110,"code":"ETIMEDOUT","syscall":"read"}}`;
describe("RedisRepository#obfuscateTokensInfo", () => {
  test("should offuscate a token string", () => {
    const token = getNewToken(SESSION_TOKEN_LENGTH_BYTES);
    const errorMessage = getAnErrorMessage(`SESSION-${token}`);
    expect(obfuscateTokensInfo(errorMessage)).toEqual(
      getAnErrorMessage(`SESSION-redacted`),
    );
  });
});
