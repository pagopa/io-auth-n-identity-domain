import { vi } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import { ProfileEmailRepository } from "../../repositories";

export const emailInsertMock = vi.fn(_args => _args =>
  TE.right<Error, void>(void 0)
);

export const emailDeleteMock = vi.fn(_args => _args =>
  TE.right<Error, void>(void 0)
);
export const profileEmailRepositoryMock: ProfileEmailRepository = {
  emailInsert: emailInsertMock,
  emailDelete: emailDeleteMock
};
