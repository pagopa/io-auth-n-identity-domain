import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPackageInfoAdapter } from "../package-info-loader.js";

const validPackageJson = JSON.stringify({ name: "my-app", version: "1.2.3" });

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-package-info-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { force: true, recursive: true });
});

describe("createFsPackageInfoLoader", () => {
  describe("load()", () => {
    it("returns Ok with name and version when package.json is valid", () => {
      const path = join(tmpDir, "package.json");
      writeFileSync(path, validPackageJson);

      const result = createPackageInfoAdapter(path).load();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        name: "my-app",
        version: "1.2.3",
      });
    });

    it("returns Err when the file does not exist", () => {
      const result = createPackageInfoAdapter(
        join(tmpDir, "missing.json"),
      ).load();

      expect(result.isErr()).toBe(true);
    });

    it("returns Err when the file is not valid JSON", () => {
      const path = join(tmpDir, "package.json");
      writeFileSync(path, "not-json");

      const result = createPackageInfoAdapter(path).load();

      expect(result.isErr()).toBe(true);
    });

    it("returns Err when name is missing", () => {
      const path = join(tmpDir, "package.json");
      writeFileSync(path, JSON.stringify({ version: "1.0.0" }));

      const result = createPackageInfoAdapter(path).load();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toMatch(
        /"name" and "version" must be strings/,
      );
    });

    it("returns Err when version is missing", () => {
      const path = join(tmpDir, "package.json");
      writeFileSync(path, JSON.stringify({ name: "my-app" }));

      const result = createPackageInfoAdapter(path).load();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toMatch(
        /"name" and "version" must be strings/,
      );
    });
  });
});
