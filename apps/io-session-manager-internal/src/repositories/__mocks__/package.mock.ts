import { vi } from "vitest";
import { Package } from "../package";

export const aPackageName = "io-session-manager-internal";
export const aPackageVersion = "1.0.0";
export const aPackageInfo = {
  name: aPackageName,
  version: aPackageVersion,
};

export const mockPackage: Package = {
  getValueFromPackageJson: vi.fn().mockReturnValue(aPackageName),
  getCurrentBackendVersion: vi.fn().mockReturnValue(aPackageVersion),
};
