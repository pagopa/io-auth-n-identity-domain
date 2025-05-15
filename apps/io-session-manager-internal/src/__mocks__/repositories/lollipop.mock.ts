import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { LollipopRepository } from "../../repositories/lollipop";

export const mockfireAndForgetRevokeAssertionRef = vi
  .fn()
  .mockReturnValue(RTE.right(true));
export const LollipopRepositoryMock: LollipopRepository = {
  fireAndForgetRevokeAssertionRef: mockfireAndForgetRevokeAssertionRef,
};
