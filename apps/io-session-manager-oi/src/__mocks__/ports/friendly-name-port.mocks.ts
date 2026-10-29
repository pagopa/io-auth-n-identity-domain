
import { vi } from "vitest";
import { IdpFriendlyNamePort } from "../../domain/ports/outbound/friendly-name.port.js";

export const IdpFriendlyNamePortMock = {
  getFriendlyName: vi.fn(),
} satisfies IdpFriendlyNamePort;
