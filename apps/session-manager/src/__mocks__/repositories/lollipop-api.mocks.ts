import { vi } from "vitest";
import * as E from "fp-ts/Either";

import { LollipopApiClient } from "../../repositories/lollipop-api";
import { aValidLCParamsResult } from "../lollipop.mocks";

export const mockGenerateLCParams = vi.fn().mockResolvedValue(
  E.right({
    status: 200,
    value: aValidLCParamsResult,
  }),
);

const mockActivatePubKey = vi.fn();
const mockReservePubKey = vi.fn();
const mockPing = vi.fn();

export const mockedLollipopApiClient: LollipopApiClient = {
  generateLCParams: mockGenerateLCParams,
  reservePubKey: mockReservePubKey,
  activatePubKey: mockActivatePubKey,
  ping: mockPing,
};
