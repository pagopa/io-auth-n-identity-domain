import * as E from "fp-ts/lib/Either";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomDependencyRepository } from "../custom-dependency";

describe("custom dependency repository tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should test repository", async () => {
    const result = await CustomDependencyRepository.ping({})();
    expect(result).toEqual(E.right(true));
  });
});
