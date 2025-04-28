import { PackageUtils } from "../utils/package";

export const aPackageName = "io-session-manager-internal";
export const aPackageVersion = "1.0.0";
export const aPackageInfo = {
  name: aPackageName,
  version: aPackageVersion,
};

export const mockPackageUtils: PackageUtils = {
  getValueFromPackageJson: (_) => aPackageName,
  getCurrentBackendVersion: () => aPackageVersion,
};
