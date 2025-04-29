import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/Either";
import {
  aPackageInfo,
  aPackageVersion,
  mockPackage,
} from "../../repositories/__mocks__/package.mock";
import { InfoService } from "../info";

describe("Info service getPackageInfo", () => {
  const unknownValue = "UNKNOWN";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed", async () => {
    const result = await InfoService.getPackageInfo({
      Package: mockPackage,
    })();

    expect(mockPackage.getValueFromPackageJson).toHaveBeenCalledOnce();
    expect(mockPackage.getCurrentBackendVersion).toHaveBeenCalledOnce();
    expect(result).toMatchObject(E.right(aPackageInfo));
  });

  it("should work even if getValueFromPackageJson returns UNKNOWN", async () => {
    const mockGetValueFromPackageJson = vi.fn().mockReturnValue(unknownValue);
    const result = await InfoService.getPackageInfo({
      Package: {
        ...mockPackage,
        getValueFromPackageJson: mockGetValueFromPackageJson,
      },
    })();

    expect(mockPackage.getValueFromPackageJson).not.toHaveBeenCalled();
    expect(mockGetValueFromPackageJson).toHaveBeenCalledOnce();
    expect(mockPackage.getCurrentBackendVersion).toHaveBeenCalledOnce();
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
      Package: {
        ...mockPackage,
        getCurrentBackendVersion: mockGetCurrentBackendVersion,
      },
    })();

    expect(mockPackage.getValueFromPackageJson).toHaveBeenCalledOnce();
    expect(mockGetCurrentBackendVersion).toHaveBeenCalledOnce();
    expect(mockPackage.getCurrentBackendVersion).not.toHaveBeenCalled();
    expect(result).toMatchObject(
      E.right({
        name: aPackageInfo.name,
        version: unknownValue,
      }),
    );
  });
});
