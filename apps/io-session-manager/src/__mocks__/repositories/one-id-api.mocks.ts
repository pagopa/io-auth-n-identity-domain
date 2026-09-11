import { vi } from "vitest";
import * as TE from "fp-ts/TaskEither";
import { getOneIdAPIClient } from "../../repositories/one-id-api";

export const mockGetSamlAssertion = vi.fn(() => TE.right("<xml/>"));

export const mockedOneIdAPIClient: ReturnType<typeof getOneIdAPIClient> = {
  getSamlAssertion: mockGetSamlAssertion,
};
