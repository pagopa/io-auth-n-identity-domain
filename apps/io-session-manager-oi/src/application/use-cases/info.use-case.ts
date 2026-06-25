import type { UseCase } from "@pagopa/io-core-domain";
import { ok } from "neverthrow";

interface InfoOutput {
  readonly name: string;
  readonly version: string;
}

export const getInfoUseCase: UseCase<
  Record<string, never>,
  InfoOutput,
  never
> = async () =>
  // TODO: Get those infos from the package.json
  ok({
    name: "io-session-manager-oi",
    version: "0.0.1",
  });
