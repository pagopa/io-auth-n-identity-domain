import * as E from "fp-ts/lib/Either";
import { expect, it } from "vitest";
import { mockCustomDependencyRepository } from "../../__mocks__/repositories/custom-dependency.mock";
import { InfoService } from "../info";

it("should test service", async () => {
  const deps = {
    CustomDependencyRepository: mockCustomDependencyRepository,
  };

  const result = await InfoService.pingCustomDependency(deps)();

  expect(result).toStrictEqual(E.right("PONG"));
});
