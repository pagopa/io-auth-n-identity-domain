import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type { AuthEventPort } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeSendLogoutEventUseCase } from "../send-logout-event.js";

const event: Extract<AuthEvent, { eventType: "logout" }> = {
  eventType: "logout",
  fiscalCode: FiscalCodeSchema.parse("ISPXNB32R82Y766D"),
  scenario: "auth_lock",
  ts: new Date("2026-01-01T00:00:00Z"),
};
const sendEvent = vi.fn<AuthEventPort["sendEvent"]>();
const trackEvent = vi.fn();
const deps = {
  authEventPort: { sendEvent },
  logger: { trackEvent } as unknown as Logger,
};
const sendLogoutEvent = makeSendLogoutEventUseCase(deps);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("sendLogoutEvent", () => {
  it("does not track telemetry when publishing succeeds", async () => {
    sendEvent.mockResolvedValueOnce(ok(undefined));

    expect(await sendLogoutEvent(event)).toEqual(ok(undefined));
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("tracks the emission failure and returns the error", async () => {
    const error = new GenericError("bus down");
    sendEvent.mockResolvedValueOnce(err(error));

    expect(await sendLogoutEvent(event)).toEqual(err(error));
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith({
      name: "service-bus.auth-event.emission-failure",
      properties: { eventData: JSON.stringify(event), message: error.message },
    });
  });
});
