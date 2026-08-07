import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeExchangeCodeMiddleware } from "../exchange-code.middleware.js";
import { type AusiliarDataContext } from "../retrieve-ausiliar-data.middleware.js";
import { type OidcPort } from "../../../../../domain/ports/outbound/oidc.port.js";
import { type LoginAusiliarData } from "../../../../../domain/value-objects/login.vo.js";
import { type OidcClaims } from "../../../../../domain/value-objects/oidc-claims.vo.js";

const anAusiliarData: LoginAusiliarData = {
  loginType: "LV",
  lollipopAssertionRef:
    "sha256-thumbprint" as LoginAusiliarData["lollipopAssertionRef"],
  clientId: "a-client-id" as LoginAusiliarData["clientId"],
  minAuthLevel: "SpidL2",
  oidcConfigurationEnv: "PROD",
  nonce: "a-nonce" as LoginAusiliarData["nonce"],
};

const aContext: AusiliarDataContext = { ausiliarData: anAusiliarData };

const aClaims = {
  fiscalNumber: "ISPXNB32R82Y766D",
  name: "Carla",
  familyName: "Rossi",
  dateOfBirth: new Date("1987-08-14"),
  acr: "https://www.spid.gov.it/SpidL2",
  iss: "https://uat.io.oneid.pagopa.it",
} as OidcClaims;

const oidcExchangePort: OidcPort = {
  exchange: vi.fn(),
};

const middleware = makeExchangeCodeMiddleware(oidcExchangePort);

const invoke = (query: unknown) =>
  middleware({ context: aContext, payload: { query } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("makeExchangeCodeMiddleware", () => {
  it("returns ok(claims) and forwards nonce and env from the context", async () => {
    vi.mocked(oidcExchangePort.exchange).mockResolvedValue(ok(aClaims));

    const result = await invoke({ code: "an-auth-code", state: "a-state" });

    expect(result).toEqual(ok({ claims: aClaims }));
    expect(oidcExchangePort.exchange).toHaveBeenCalledExactlyOnceWith({
      env: anAusiliarData.oidcConfigurationEnv,
      query: { code: "an-auth-code", state: "a-state" },
      expectedState: "a-state",
      expectedNonce: anAusiliarData.nonce,
    });
  });

  it("returns err(AuthenticationError) when the code is missing", async () => {
    const result = await invoke({ state: "a-state" });

    expect(result).toEqual(err(new AuthenticationError()));
    expect(oidcExchangePort.exchange).not.toHaveBeenCalled();
  });

  it("returns err(AuthenticationError) when the state is missing", async () => {
    const result = await invoke({ code: "an-auth-code" });

    expect(result).toEqual(err(new AuthenticationError()));
    expect(oidcExchangePort.exchange).not.toHaveBeenCalled();
  });

  it("forwards the error when the exchange fails", async () => {
    vi.mocked(oidcExchangePort.exchange).mockResolvedValue(
      err(new GenericError("provider outage")),
    );

    const result = await invoke({ code: "an-auth-code", state: "a-state" });

    expect(result).toEqual(err(new GenericError("provider outage")));
  });
});
