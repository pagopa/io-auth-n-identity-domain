import type { Result } from "neverthrow";

import type { PackageInfoError } from "./package-info.error.js";

export interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

export interface PackageInfoOutboundPort {
  load(): Result<PackageInfo, PackageInfoError>;
}
