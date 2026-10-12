import { describe, expect, it, vi } from "vitest";
import * as Package from "../package";

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  const packageJsonPath = path.resolve(__dirname, "../../../package.json");

  const mockPackageName = "mocked-package";
  const mockPackageVersion = "0.0.1";
  const mockPackageDescription = "This is a mocked package description";
  const mockPackageJson = {
    name: mockPackageName,
    description: mockPackageDescription,
    version: mockPackageVersion,
  };

  require.cache[packageJsonPath] = {
    id: packageJsonPath,
    filename: packageJsonPath,
    loaded: true,
    exports: mockPackageJson,
    children: [],
    paths: [],
  } as unknown as NodeModule;
});

const mockPackageName = "mocked-package";
const mockPackageVersion = "0.0.1";
const mockPackageDescription = "This is a mocked package description";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../../../package.json");

describe("Package getValueFromPackageJson", () => {
  it("should return the value of the specified key", () => {
    expect(Package.getValueFromPackageJson("name")).toBe(mockPackageName);
    expect(Package.getValueFromPackageJson("version")).toBe(mockPackageVersion);
    expect(Package.getValueFromPackageJson("description")).toBe(
      mockPackageDescription,
    );
  });

  it("should return 'UNKNOWN' if the key does not exist", () => {
    const unknownKey = pkg.unknownKey;
    expect(unknownKey).toBeUndefined();
    expect(Package.getValueFromPackageJson(unknownKey)).toBe("UNKNOWN");

    const anotherUnknownKey = "unknownKey";
    expect(Package.getValueFromPackageJson(anotherUnknownKey)).toBe("UNKNOWN");
  });
});

describe("Package getCurrentBackendVersion", () => {
  it("should return the current backend version", () => {
    const version = pkg.version;
    expect(version).toBe(mockPackageVersion);
  });

  it("should return 'UNKNOWN' if the version does not exist", () => {
  
    delete pkg.version;
    expect(Package.getCurrentBackendVersion()).toBe("UNKNOWN");
  
    pkg.version = mockPackageVersion; // Restore the version for other tests
  });
});
