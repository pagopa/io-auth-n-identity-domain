import { readFileSync } from "node:fs";

import { err, ok } from "neverthrow";

import { PackageInfoError } from "./package-info.error.js";
import type {
  PackageInfo,
  PackageInfoOutboundPort,
} from "./package-info.port.js";

export const createPackageInfoAdapter = (
  packageJsonPath: string,
): PackageInfoOutboundPort => ({
  load() {
    let content: Record<string, unknown>;

    try {
      content = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch (e) {
      return err(
        new PackageInfoError(`Failed to read ${packageJsonPath}: ${String(e)}`),
      );
    }

    const { name, version } = content;

    if (typeof name !== "string" || typeof version !== "string") {
      return err(
        new PackageInfoError(
          `Invalid package.json at ${packageJsonPath}: "name" and "version" must be strings`,
        ),
      );
    }

    return ok({ name, version } satisfies PackageInfo);
  },
});
