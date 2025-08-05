import { expect, it } from "vitest";
import * as E from "fp-ts/lib/Either";
import { httpHandlerInputMocks } from "../../__mocks__/controllers/handler.mock";
import { makeInfoHandler } from "../info";
import { CustomDependencyRepository } from "../../repositories/custom-dependency";
import { mockInfoService } from "../../__mocks__/services/info-service.mock";

it("tests a controller", async () => {
  const aReq = httpHandlerInputMocks;
  const mockDeps = {
    InfoService: mockInfoService,
    // we are mocking the service that sits above the repository
    CustomDependencyRepository: {} as CustomDependencyRepository,
  };
  const result = await makeInfoHandler({ ...aReq, ...mockDeps })();
  expect(result).toMatchObject(E.right({ body: { message: "success" } }));
});
