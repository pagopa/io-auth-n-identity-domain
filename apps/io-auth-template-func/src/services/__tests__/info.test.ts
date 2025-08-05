import { beforeEach } from "node:test";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { describe, expect, it, vi } from "vitest";
import {
  mockCustomDependencyRepository,
  mockPing,
} from "../../__mocks__/repositories/custom-dependency.mock";
import { InfoService } from "../info";

const deps = {
  CustomDependencyRepository: mockCustomDependencyRepository,
};

describe("info service tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should test service", async () => {
    const result = await InfoService.pingCustomDependency(deps)();

    expect(result).toStrictEqual(E.right("PONG"));
  });

  it("should test service failure", async () => {
    const aCustomError = Error("an error");
    mockPing.mockReturnValueOnce(TE.left(aCustomError));
    const result = await InfoService.pingCustomDependency(deps)();

    expect(result).toStrictEqual(
      E.left(Error("InfoService returned an error")),
    );
  });
});
