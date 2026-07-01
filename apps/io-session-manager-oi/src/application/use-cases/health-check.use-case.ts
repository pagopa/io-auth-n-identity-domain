import { type UseCase } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import { ok } from "neverthrow";
import { type z } from "zod";

import { type HealthCheckOutputSchema } from "../../adapters/inbound/dtos/health-check.dto.js";
import { HealthCheckOutboundPort } from "../../domain/ports/outbound/health-check.outbound-port.js";

type HealthCheckOutput = z.input<typeof HealthCheckOutputSchema>;

type NamedHealthCheckOutboundPort = {
  name: string;
  port: HealthCheckOutboundPort;
};

export const getHealthCheckUseCase =
  (
    packageInfo: PackageInfo,
    outboundPorts: ReadonlyArray<NamedHealthCheckOutboundPort>,
  ): UseCase<Record<never, never>, HealthCheckOutput, never> =>
  async () => {
    const errors = await collectErrors(outboundPorts);
    return ok({
      ...packageInfo,
      ...(errors.length > 0 ? { errors } : {}),
    });
  };

const collectErrors = async (
  outboundPorts: ReadonlyArray<NamedHealthCheckOutboundPort>,
): Promise<ReadonlyArray<string>> => {
  const results = await Promise.all(
    outboundPorts.map(async ({ name, port }) => ({
      name,
      result: await port.healthcheck(),
    })),
  );
  return results.flatMap(({ name, result }) =>
    result.isErr() ? [`${name}: ${result.error.message}`] : [],
  );
};
