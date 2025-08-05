import * as E from "fp-ts/lib/Either";
import { expect, it } from "vitest";
import { CustomDependencyRepository } from "../custom-dependency";

it("should test repository", async () => {
  const result = await CustomDependencyRepository.ping({})();
  expect(result).toEqual(E.right(true));
});
