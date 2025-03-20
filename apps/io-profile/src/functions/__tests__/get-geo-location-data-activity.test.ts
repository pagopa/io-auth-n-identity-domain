import { IPString } from "@pagopa/ts-commons/lib/strings";
import { describe, expect, it, vi } from "vitest";
import { context } from "../__mocks__/durable-functions";
import { TransientNotImplementedFailure } from "../../utils/durable";
import { getGeoLocationHandler } from "../get-geo-location-data-activity";

const aValidPayload = { ip_address: "127.0.0.1" as IPString };
const mockGeoLocationService = {
  getGeoLocationForIp: vi.fn().mockRejectedValue({ status: 501 }),
};

describe("GetGeoLocationDataActivity", () => {
  it("should return a NOT_YET_IMPLEMENTED failure", async () => {
    const result = await getGeoLocationHandler(mockGeoLocationService)(
      context as any,
      aValidPayload,
    );
    expect(TransientNotImplementedFailure.is(result)).toEqual(true);
  });
  it("should return a FAILURE when the input is not valid", async () => {
    const result = await getGeoLocationHandler(mockGeoLocationService)(
      context as any,
      {},
    );

    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "Error while decoding input",
    });
  });
});
