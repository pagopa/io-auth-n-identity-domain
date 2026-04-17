import { afterEach, describe, expect, it, vi } from "vitest";
import { PingHandler } from "../ping";

const aName = "io-profile";
const aVersion = "1.0.0";

vi.mock("../../utils/package", () => ({
  getCurrentBackendVersion: () => aVersion,
  getValueFromPackageJson: () => aName,
}));

describe("PingHandler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return a success", async () => {
    const handler = PingHandler();

    const response = await handler();

    expect(response.kind).toBe("IResponseSuccessJson");
    expect(response.value).toEqual({
      name: aName,
      version: aVersion,
    });
  });
});
