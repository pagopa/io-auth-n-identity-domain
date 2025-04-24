import { describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as H from "@pagopa/handler-kit";
import { makeInfoHandler } from "../info";
import * as packageUtils from "../../utils/package";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";

const getCurrentBackendVersionMock = vi.spyOn(
  packageUtils,
  "getCurrentBackendVersion",
);

describe("Info handler", () => {
  it("should succeed if the application is healthy", async () => {
    getCurrentBackendVersionMock.mockReturnValueOnce("1.0.0");

    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
    })();

    expect(result).toMatchObject(
      E.right(
        H.successJson({
          name: "io-session-manager-internal",
          version: "1.0.0",
        }),
      ),
    );
  });
});
