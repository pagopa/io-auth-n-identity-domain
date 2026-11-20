import { vi } from "vitest";
import { LollipopRevocationPort } from "@pagopa/io-session-manager-core";

export const lollipopRevocationPortMock = {
  requestRevocation: vi.fn(),
} satisfies LollipopRevocationPort;
