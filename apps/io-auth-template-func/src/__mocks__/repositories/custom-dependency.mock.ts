import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";
import { CustomDependencyRepository } from "../../repositories/custom-dependency";

export const mockPing = vi.fn().mockReturnValue(TE.of(true as const));
export const mockCustomDependencyRepository: CustomDependencyRepository = {
  ping: mockPing,
};
