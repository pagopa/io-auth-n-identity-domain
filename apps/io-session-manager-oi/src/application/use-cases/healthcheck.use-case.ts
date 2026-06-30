import { GenericError, type UseCase } from "@pagopa/io-core-domain";
import { err, ok } from "neverthrow";
import { HealthCheckOutboundPort } from "../../domain/ports/outbound/healthcheck.outbound-port.js";
import {
  PackageInfoOutboundPort,
  PackageInfoError,
} from "@pagopa/io-package-info";

interface HealthCheckInput {
  readonly packageInfo: { name: string; version: string };
  readonly outboundPorts: ReadonlyArray<HealthCheckOutboundPort>;
}

interface HealthCheckOutput {
  readonly name: string;
  readonly version: string;
}

export const getHealthCheckUseCase =
  (
    packageInfoPort: PackageInfoOutboundPort,
    outboundPorts: ReadonlyArray<HealthCheckOutboundPort>,
  ): UseCase<
    HealthCheckInput,
    HealthCheckOutput,
    PackageInfoError | GenericError
  > =>
  async () => {
    const packageInfoResult = packageInfoPort.load();
    if (packageInfoResult.isErr()) {
      return err(packageInfoResult.error);
    }

    const packageInfo = packageInfoResult.value;

    const errors = await collectErrors(outboundPorts);
    if (errors.length > 0) {
      return err(new GenericError(`Healthcheck failed: ${errors.join(" | ")}`));
    }

    return ok({
      ...packageInfo,
    });
  };

const collectErrors = async (
  outboundPorts: ReadonlyArray<HealthCheckOutboundPort>,
): Promise<ReadonlyArray<string>> => {
  const results = await Promise.all(
    outboundPorts.map(async (port) => ({
      port,
      result: await port.healthcheck(),
    })),
  );
  return results.flatMap(({ port, result }) =>
    result.isErr() ? [`${port.constructor.name}: ${result.error.message}`] : [],
  );
};
