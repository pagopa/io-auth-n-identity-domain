import { describe, expect, it, Mock } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as H from "@pagopa/handler-kit";
import { makeInfoHandler } from "../info";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import { mockInfoService } from "../../services/__mocks__/info.mock";
import { aPackageInfo } from "../../repositories/__mocks__/package.mock";
import { Package } from "../../repositories/package";

describe("Info handler", () => {
  it("should succeed if the application is healthy", async () => {
    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      InfoService: mockInfoService,
      Package: {} as Package,
    })();

    expect(result).toMatchObject(E.right(H.successJson(aPackageInfo)));
  });

  it("should return an error if the application is unhealthy", async () => {
    (mockInfoService.getPackageInfo as Mock).mockImplementationOnce(
      () => () => Promise.resolve(E.left(new Error("Error"))),
    );

    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      InfoService: mockInfoService,
      Package: {} as Package,
    })();

    expect(result).toMatchObject(
      E.right(H.problemJson({ status: 500, title: "" })),
    );
  });
});
