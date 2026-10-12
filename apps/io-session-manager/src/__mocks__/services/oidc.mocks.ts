import { vi } from "vitest";
import { CallbackDeps, ReserveDeps } from "../../services/oidc";

export const mockReserveInner = vi.fn();
export const mockReserve = vi.fn((_deps: ReserveDeps) => mockReserveInner);

export const mockOIDCCallbackInner = vi.fn();
export const mockOIDCCallback = vi.fn(
  (_deps: CallbackDeps) => mockOIDCCallbackInner,
);
