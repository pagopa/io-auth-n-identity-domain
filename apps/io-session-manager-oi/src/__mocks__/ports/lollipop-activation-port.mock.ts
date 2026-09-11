import { LollipopActivationPort } from "@pagopa/io-auth-n-identity-session/ports";
import { vi } from "vitest";

export const lollipopActivationPortMock = {
  getByFiscalCode: vi.fn(),
  activate: vi.fn(),
  revokeByFiscalCode: vi.fn(),
} satisfies LollipopActivationPort;
