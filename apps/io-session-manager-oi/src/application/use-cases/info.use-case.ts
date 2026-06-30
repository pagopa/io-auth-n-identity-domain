import { GenericError, type UseCase } from "@pagopa/io-core-domain";
import { err, ok } from "neverthrow";
import { HealthCheckOutboundPort } from "../../domain/ports/outbound/healthcheck.outbound-port.js";
import {
  PackageInfoOutboundPort,
  PackageInfoError,
} from "@pagopa/io-package-info";

interface InfoInput {
  readonly packageInfo: { name: string; version: string };
}

interface InfoOutput {
  readonly name: string;
  readonly version: string;
}

export const getInfoUseCase =
  (
    packageInfoPort: PackageInfoOutboundPort,
  ): UseCase<InfoInput, InfoOutput, PackageInfoError | GenericError> =>
  async () => {
    const packageInfoResult = packageInfoPort.load();
    if (packageInfoResult.isErr()) {
      return err(packageInfoResult.error);
    }

    const packageInfo = packageInfoResult.value;

    return ok({
      ...packageInfo,
    });
  };
