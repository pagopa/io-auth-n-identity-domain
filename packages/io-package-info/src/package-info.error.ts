import { BaseError } from "@pagopa/io-core-domain/errors";

export class PackageInfoError extends BaseError {
  override readonly kind = "PackageInfoError" as const;
  override readonly tag = "package-info-error" as const;

  constructor(message: string) {
    super(message);
  }
}
