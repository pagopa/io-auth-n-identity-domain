import {
  AuthenticationError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRetrieveAusiliarDataMiddleware } from "../retrieve-ausiliar-data.middleware.js";
import { type AusiliarDataPort } from "../../../../../domain/ports/outbound/ausiliar-data.port.js";
import { type LoginAusiliarData } from "../../../../../domain/value-objects/login.vo.js";

const anAusiliarData: LoginAusiliarData = {
  loginType: "LV",
  lollipopAssertionRef:
    "sha256-thumbprint" as LoginAusiliarData["lollipopAssertionRef"],
  clientId: "a-client-id" as LoginAusiliarData["clientId"],
  minAuthLevel: "SpidL2",
  oidcConfigurationEnv: "PROD",
  nonce: "a-nonce" as LoginAusiliarData["nonce"],
};

const ausiliarDataPort: AusiliarDataPort = {
  save: vi.fn(),
  retrieve: vi.fn(),
  healthcheck: vi.fn(),
};

const middleware = makeRetrieveAusiliarDataMiddleware(ausiliarDataPort);

const invoke = (query: unknown) =>
  middleware({ context: {}, payload: { query } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("makeRetrieveAusiliarDataMiddleware", () => {
  it("returns ok(ausiliarData) and looks it up by state on success", async () => {
    vi.mocked(ausiliarDataPort.retrieve).mockResolvedValue(ok(anAusiliarData));

    const result = await invoke({ state: "a-state" });

    expect(result).toEqual(ok({ ausiliarData: anAusiliarData }));
    expect(ausiliarDataPort.retrieve).toHaveBeenCalledExactlyOnceWith(
      "a-state",
    );
  });

  it("returns err(AuthenticationError) when the state is missing", async () => {
    const result = await invoke({});

    expect(result).toEqual(err(new AuthenticationError()));
    expect(ausiliarDataPort.retrieve).not.toHaveBeenCalled();
  });

  it("returns err(AuthenticationError) when the auxiliary data is not found", async () => {
    vi.mocked(ausiliarDataPort.retrieve).mockResolvedValue(
      err(new NotFoundError("LoginAusiliarData", "not found")),
    );

    const result = await invoke({ state: "a-state" });

    expect(result).toEqual(err(new AuthenticationError()));
  });

  it("returns err(GenericError) when the port fails with an infrastructure error", async () => {
    vi.mocked(ausiliarDataPort.retrieve).mockResolvedValue(
      err(new GenericError("redis down")),
    );

    const result = await invoke({ state: "a-state" });

    expect(result).toEqual(err(new GenericError("Generic error: redis down")));
  });
});
