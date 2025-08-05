import * as TE from "fp-ts/lib/TaskEither";
import * as H from "@pagopa/handler-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import { httpHandlerInputMocks } from "../../__mocks__/controllers/handler.mock";
import { makeInfoHandler } from "../info";
import { CustomDependencyRepository } from "../../repositories/custom-dependency";
import {
  mockInfoService,
  mockPingCustomDependency,
} from "../../__mocks__/services/info-service.mock";

const aReq = httpHandlerInputMocks;
const mockDeps = {
  InfoService: mockInfoService,
  // we are mocking the service that sits above the repository
  CustomDependencyRepository: {} as CustomDependencyRepository,
};

describe("info controller tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tests a controller", async () => {
    const result = await makeInfoHandler({ ...aReq, ...mockDeps })();
    expect(result).toMatchObject(E.right({ body: { message: "success" } }));
  });

  it("tests a controller failure", async () => {
    const aCustomError = Error("an error");
    mockPingCustomDependency.mockReturnValueOnce(TE.left(aCustomError));
    const result = await makeInfoHandler({ ...aReq, ...mockDeps })();
    expect(result).toMatchObject(E.left(new H.HttpError()));
  });
});
