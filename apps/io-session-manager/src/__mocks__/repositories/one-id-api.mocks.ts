import { vi } from "vitest";
import * as TE from "fp-ts/TaskEither";
import { getOneIdAPIClient } from "../../repositories/one-id-api";

export const mockGetSamlAssertion = vi.fn(() =>
  TE.right<Error, string>("<xml/>"),
);

export const mockedOneIdAPIClient: ReturnType<typeof getOneIdAPIClient> = {
  getSamlAssertion: mockGetSamlAssertion,
};
