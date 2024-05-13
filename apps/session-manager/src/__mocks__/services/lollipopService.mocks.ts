import { Mock, vi } from "vitest";

import * as TE from "fp-ts/TaskEither";

import { LollipopService } from "../../services";
import { GenerateLCParamsErrors } from "../../services/lollipop";

import { LcParams } from "../../generated/lollipop-api/LcParams";

import { aValidLCParamsResult } from "../lollipop.mocks";

export const mockGenerateLCParams: Mock<
  Parameters<(typeof LollipopService)["generateLCParams"]>,
  ReturnType<(typeof LollipopService)["generateLCParams"]>
> = vi.fn(
  (_assertionRef, _operationId) => (_deps) =>
    TE.of<GenerateLCParamsErrors, LcParams>(aValidLCParamsResult),
);

export const mockedLollipopService: typeof LollipopService = {
  generateLCParams: mockGenerateLCParams,
};
