import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import { getRequiredENVVar } from "../environment";
import { log } from "../logger";

const mockExit = vi.spyOn(process, "exit");
const spyLogger = vi.spyOn(log, "error");

describe("EnvUtils#getRequiredENVVar", () => {
  beforeAll(() => {
    mockExit.mockImplementation(() => undefined as never);
  });
  afterAll(() => {
    mockExit.mockRestore();
    spyLogger.mockRestore();
  });

  test("should get the expected ENV variable value", () => {
    const anEnvName = "ENV_NAME";
    const expectedValue = "anExpectedEnvValue";
    vi.stubEnv(anEnvName, expectedValue);
    const result = getRequiredENVVar(anEnvName);
    expect(result).toEqual(expectedValue);
    expect(mockExit).not.toBeCalled();
  });

  test("should kill the node process if the required env is missing", () => {
    const anotherEnvVarName = "A_MISSING_ENV_VAR";
    getRequiredENVVar(anotherEnvVarName);
    expect(mockExit).toBeCalledWith(1);
    expect(spyLogger).toBeCalledWith(
      "Missing %s required environment variable",
      anotherEnvVarName,
    );
  });
});
