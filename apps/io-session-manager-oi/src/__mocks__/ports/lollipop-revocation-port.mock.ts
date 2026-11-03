import { vi } from "vitest";
import { LollipopRevocationPort } from "../../domain/ports/outbound/lollipop-revocation.port.js";

export const lollipopRevocationPortMock = {
  requestRevocation: vi.fn(),
} satisfies LollipopRevocationPort;
