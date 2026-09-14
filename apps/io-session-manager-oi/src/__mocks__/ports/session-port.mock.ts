import { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import { ok } from "neverthrow";
import { vi } from "vitest";

import { aSessionWithHashedTokens } from "../session.mocks.js";

export const mockFindBySessionToken = vi.fn();
export const mockFindByBpdToken = vi.fn();
export const mockCreate = vi.fn();
export const mockRefresh = vi.fn();
export const mockDelete = vi.fn();
export const mockFindByFiscalCode = vi.fn();

export const SessionPortMock: SessionPort = {
  findBySessionToken: mockFindBySessionToken,
  findByBpdToken: mockFindByBpdToken,
  create: mockCreate,
  refresh: mockRefresh,
  delete: mockDelete,
  findByFiscalCode: mockFindByFiscalCode,
};

export const resetSessionPortMock = () => {
  mockFindBySessionToken.mockReset();
  mockFindByBpdToken.mockReset();
  mockRefresh.mockReset();
  mockDelete.mockReset().mockResolvedValue(ok(undefined));
  mockCreate.mockReset().mockResolvedValue(ok(aSessionWithHashedTokens));
  mockFindByFiscalCode.mockReset().mockResolvedValue(ok(undefined));
};
