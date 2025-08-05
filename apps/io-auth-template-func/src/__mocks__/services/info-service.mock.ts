import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";
import { InfoService } from "../../services/info";

export const mockPingCustomDependency = vi
  .fn()
  .mockReturnValue(TE.right("PONG"));
export const mockInfoService: InfoService = {
  pingCustomDependency: mockPingCustomDependency,
};
