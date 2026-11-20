import { LollipopRevocationPort } from "../../../domain/ports/lollipop-revocation.port.js";
import { vi } from "vitest";

export const lollipopRevocationPortMock = {
  requestRevocation: vi.fn(),
} satisfies LollipopRevocationPort;
