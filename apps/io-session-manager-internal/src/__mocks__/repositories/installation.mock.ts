import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { InstallationRepository } from "../../repositories/installation";

export const mockDeleteInstallation = vi.fn().mockReturnValue(RTE.right({}));
export const InstallationRepositoryMock: InstallationRepository = {
  deleteInstallation: mockDeleteInstallation,
};
