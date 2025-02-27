import * as TE from "fp-ts/lib/TaskEither";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthCheck, HealthProblem } from "../../utils/healthcheck-utils";
import { InfoHandler } from "../handler";

vi.mock("../../utils/package", () => ({
  getCurrentBackendVersion: () => "1.0.0",
  getValueFromPackageJson: () => "io-profile",
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("InfoHandler", () => {
  it("should return an internal error if the application is not healthy", async () => {
    const healthCheck: HealthCheck = TE.left([
      "failure 1" as HealthProblem<"Config">,
      "failure 2" as HealthProblem<"Config">,
    ]);
    const handler = InfoHandler(healthCheck);

    const response = await handler();

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should return a success if the application is healthy", async () => {
    const healthCheck: HealthCheck = TE.of(true);
    const handler = InfoHandler(healthCheck);

    const response = await handler();

    expect(response.kind).toBe("IResponseSuccessJson");
  });
});
