import type { ServiceBusSender } from "@azure/service-bus";
import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import {
  type AuthEvent,
  AuthEventSchema,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventServiceBusAdapter } from "../auth-event-service-bus.adapter.js";

const mocks = vi.hoisted(() => ({
  serviceBusSender: {
    createMessageBatch: vi.fn(),
    sendMessages: vi.fn(),
  },
}));

const adapter = new AuthEventServiceBusAdapter(
  mocks.serviceBusSender as unknown as ServiceBusSender,
);

const AUTH_EVENT: AuthEvent = {
  eventType: "login",
  fiscalCode: FiscalCodeSchema.parse("AAAAAA00A00A000A"),
  ts: new Date("2026-08-06T00:00:00.000Z"),
  expiredAt: new Date("2026-08-06T01:00:00.000Z"),
  loginType: "lv",
  scenario: "standard",
  idp: "https://idp.example.com",
};

const INVALID_AUTH_EVENT = {
  ...AUTH_EVENT,
  ts: new Date(Number.NaN),
} as AuthEvent;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AuthEventServiceBusAdapter#sendEvent", () => {
  afterEach(() => {
    expect(mocks.serviceBusSender.createMessageBatch).not.toHaveBeenCalled();
  });

  it("sends the auth event with the expected Service Bus metadata", async () => {
    mocks.serviceBusSender.sendMessages.mockResolvedValue(undefined);

    const result = await adapter.sendEvent(AUTH_EVENT);

    expect(result).toEqual(ok(undefined));
    expect(mocks.serviceBusSender.sendMessages).toHaveBeenCalledExactlyOnceWith(
      {
        body: AuthEventSchema.encode(AUTH_EVENT),
        contentType: "application/json",
        applicationProperties: { eventType: AUTH_EVENT.eventType },
        sessionId: AUTH_EVENT.fiscalCode,
      },
    );
  });

  it("returns a GenericError and does not send when encoding fails", async () => {
    const result = await adapter.sendEvent(INVALID_AUTH_EVENT);

    expect(result.isErr()).toEqual(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GenericError);
      expect(result.error.message).toContain(
        "Failed to encode auth event message:",
      );
    }
    expect(mocks.serviceBusSender.sendMessages).not.toHaveBeenCalled();
  });

  it("returns a GenericError when Service Bus rejects with an Error", async () => {
    mocks.serviceBusSender.sendMessages.mockRejectedValue(
      new Error("Service Bus unavailable"),
    );

    const result = await adapter.sendEvent(AUTH_EVENT);

    expect(result).toEqual(
      err(
        new GenericError(
          "Failed to send auth event message: Service Bus unavailable",
        ),
      ),
    );
  });

  it("converts non-Error rejections into a GenericError", async () => {
    mocks.serviceBusSender.sendMessages.mockRejectedValue("Unexpected failure");

    const result = await adapter.sendEvent(AUTH_EVENT);

    expect(result).toEqual(
      err(
        new GenericError(
          "Failed to send auth event message: Unexpected failure",
        ),
      ),
    );
  });
});

describe("AuthEventServiceBusAdapter#healthcheck", () => {
  afterEach(() => {
    expect(mocks.serviceBusSender.sendMessages).not.toHaveBeenCalled();
  });

  it("returns ok when a message batch can be created", async () => {
    mocks.serviceBusSender.createMessageBatch.mockResolvedValue({});

    const result = await adapter.healthcheck();

    expect(result).toEqual(ok(undefined));
    expect(
      mocks.serviceBusSender.createMessageBatch,
    ).toHaveBeenCalledExactlyOnceWith();
  });

  it("returns a GenericError when creating a message batch fails", async () => {
    mocks.serviceBusSender.createMessageBatch.mockRejectedValue(
      new Error("Service Bus unavailable"),
    );

    const result = await adapter.healthcheck();

    expect(result).toEqual(
      err(
        new GenericError(
          "Failed to perform healthcheck on auth event Service Bus sender: Service Bus unavailable",
        ),
      ),
    );
  });

  it("converts non-Error rejections into a GenericError", async () => {
    mocks.serviceBusSender.createMessageBatch.mockRejectedValue(
      "Unexpected failure",
    );

    const result = await adapter.healthcheck();

    expect(result).toEqual(
      err(
        new GenericError(
          "Failed to perform healthcheck on auth event Service Bus sender: Unexpected failure",
        ),
      ),
    );
  });
});
