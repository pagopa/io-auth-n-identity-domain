import { vi } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import { ServicePreferencesRepository } from "../../repositories";

export const createServicePreferenceMock = vi.fn(_preference => () =>
  TE.of<Error, boolean>(true)
);
export const servicePreferencesRepositoryMock: ServicePreferencesRepository = {
  createServicePreference: createServicePreferenceMock
};
