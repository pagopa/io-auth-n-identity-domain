import { Mock, vi } from "vitest";

import * as TE from "fp-ts/TaskEither";

import { LollipopService } from "../../services";

import { aValidLCParamsResult } from "../lollipop.mocks";

type GenerateLCParams = (typeof LollipopService)["generateLCParams"];
type RevokeAssertionRefAssociation =
  (typeof LollipopService)["deleteAssertionRefAssociation"];

export const mockGenerateLCParams: Mock<
  Parameters<GenerateLCParams>,
  ReturnType<GenerateLCParams>
> = vi.fn(
  (_assertionRef, _operationId) => (_deps) => TE.of(aValidLCParamsResult),
);

export const mockRevokeAssertionRefAssociation: Mock<
  Parameters<RevokeAssertionRefAssociation>,
  ReturnType<RevokeAssertionRefAssociation>
> = vi.fn((_assertionRef, _operationId, _, __) => (_deps) => TE.of(true));

export const mockedLollipopService: typeof LollipopService = {
  generateLCParams: mockGenerateLCParams,
  deleteAssertionRefAssociation: mockRevokeAssertionRefAssociation,
};
