import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/Either";
import {
  aPackageInfo,
  aPackageVersion,
  mockPackageUtils,
} from "../../__mocks__/package.mock";
import { InfoService } from "../info";

describe("Info service getPackageInfo", () => {
  const unknownValue = "UNKNOWN";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed", async () => {
    const result = await InfoService.getPackageInfo({
      PackageUtils: mockPackageUtils,
    })();

    expect(mockPackageUtils.getValueFromPackageJson).toHaveBeenCalledOnce();
    expect(mockPackageUtils.getCurrentBackendVersion).toHaveBeenCalledOnce();
    expect(result).toMatchObject(E.right(aPackageInfo));
  });

  it("should work even if getValueFromPackageJson returns UNKNOWN", async () => {
    const mockGetValueFromPackageJson = vi.fn().mockReturnValue(unknownValue);
    const result = await InfoService.getPackageInfo({
      PackageUtils: {
        ...mockPackageUtils,
        getValueFromPackageJson: mockGetValueFromPackageJson,
      },
    })();

    expect(mockPackageUtils.getValueFromPackageJson).not.toHaveBeenCalled();
    expect(mockGetValueFromPackageJson).toHaveBeenCalledOnce();
    expect(mockPackageUtils.getCurrentBackendVersion).toHaveBeenCalledOnce();
    expect(result).toMatchObject(
      E.right({
        name: unknownValue,
        version: aPackageVersion,
      }),
    );
  });

  it("should work even if getCurrentBackendVersion returns UNKNOWN", async () => {
    const mockGetCurrentBackendVersion = vi.fn().mockReturnValue(unknownValue);
    const result = await InfoService.getPackageInfo({
      PackageUtils: {
        ...mockPackageUtils,
        getCurrentBackendVersion: mockGetCurrentBackendVersion,
      },
    })();

    expect(mockPackageUtils.getValueFromPackageJson).toHaveBeenCalledOnce();
    expect(mockGetCurrentBackendVersion).toHaveBeenCalledOnce();
    expect(mockPackageUtils.getCurrentBackendVersion).not.toHaveBeenCalled();
    expect(result).toMatchObject(
      E.right({
        name: aPackageInfo.name,
        version: unknownValue,
      }),
    );
  });
});
