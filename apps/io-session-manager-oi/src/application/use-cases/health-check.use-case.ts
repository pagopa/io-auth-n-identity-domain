import { GenericError, type UseCase } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { type PackageInfo } from "@pagopa/io-package-info";
import { ok, err } from "neverthrow";
import { z } from "zod";

export const HealthCheckOutputSchema = z
  .object({
    name: z.string(),
    version: z.string(),
  });

export type HealthCheckOutput = z.input<typeof HealthCheckOutputSchema>;

type NamedHealthCheckOutboundPort = {
  name: string;
  port: HealthCheckOutboundPort;
};

export const getHealthCheckUseCase =
  (
    packageInfo: PackageInfo,
    outboundPorts: ReadonlyArray<NamedHealthCheckOutboundPort>,
  ): UseCase<Record<never, never>, HealthCheckOutput, GenericError> =>
  async () => {
    const errors = await collectErrors(outboundPorts);

    if (errors.length > 0) {
      return err(
        new GenericError(
          `Health check failed for the following: ${errors.join("| ")}`,
        ),
      );
    }

    return ok(packageInfo);
  };

const collectErrors = async (
  outboundPorts: ReadonlyArray<NamedHealthCheckOutboundPort>,
): Promise<ReadonlyArray<string>> => {
  const results = await Promise.allSettled(
    outboundPorts.map(async ({ name, port }) => ({
      name,
      result: await port.healthcheck(),
    })),
  );

  return results
    .map((result, index) => {
      if (result.status === "rejected") {
        return `[${outboundPorts[index].name}]: ${result.reason}`;
      }
      if (result.status === "fulfilled" && result.value.result.isErr()) {
        const { name } = outboundPorts[index];
        const reason =
          result.value.result.error instanceof Error
            ? result.value.result.error.message
            : String(result.value.result.error);
        return `[${name}]: ${reason}`;
      }
      return null;
    })
    .filter((error): error is string => error !== null);
};
