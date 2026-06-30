import { type UseCase } from "@pagopa/io-core-domain";
import { ok } from "neverthrow";
import { HealthCheckOutboundPort } from "../../domain/ports/outbound/health-check.outbound-port.js";
import { type PackageInfo } from "@pagopa/io-package-info";
import { type z } from "zod";
import { type HealthCheckOutputSchema } from "../../adapters/inbound/dtos/health-check.dto.js";

type HealthCheckOutput = z.input<typeof HealthCheckOutputSchema>;

export const getHealthCheckUseCase =
  (
    packageInfo: PackageInfo,
    outboundPorts: ReadonlyArray<HealthCheckOutboundPort>,
  ): UseCase<Record<never, never>, HealthCheckOutput, never> =>
  async () => {
    const errors = await collectErrors(outboundPorts);
    return ok({
      ...packageInfo,
      ...(errors.length > 0 ? { errors } : {}),
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
