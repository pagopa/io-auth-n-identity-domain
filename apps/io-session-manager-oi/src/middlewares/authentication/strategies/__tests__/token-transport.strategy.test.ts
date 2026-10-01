import { AuthenticationError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import {
  AuthorizationHeaderTokenTransportStrategy,
  BearerAuthorizationHeaderTokenTransportStrategy,
  UserTokenBodyTokenTransportStrategy,
} from "../token-transport.strategy.js";

describe("AuthorizationHeaderTokenTransportStrategy", () => {
  const strategy = new AuthorizationHeaderTokenTransportStrategy();

  it("extracts the authorization header without changing its scheme", () => {
    expect(
      strategy.extract({ headers: { authorization: "Bearer session.token" } }),
    ).toEqual(ok("Bearer session.token"));
  });

  it("returns AuthenticationError when the header is missing", () => {
    expect(strategy.extract({})).toEqual(err(new AuthenticationError()));
  });
});

describe("BearerAuthorizationHeaderTokenTransportStrategy", () => {
  const strategy = new BearerAuthorizationHeaderTokenTransportStrategy();

  it("extracts the token after the Bearer scheme", () => {
    expect(
      strategy.extract({ headers: { authorization: "Bearer session.token" } }),
    ).toEqual(ok("session.token"));
  });

  it.each(["Basic session.token", "Bearer", "Bearer "])(
    "returns AuthenticationError for invalid authorization: %s",
    (authorization) => {
      expect(strategy.extract({ headers: { authorization } })).toEqual(
        err(new AuthenticationError()),
      );
    },
  );
});

describe("UserTokenBodyTokenTransportStrategy", () => {
  const strategy = new UserTokenBodyTokenTransportStrategy();

  it("extracts the user_token body field", () => {
    expect(strategy.extract({ body: { user_token: "session.token" } })).toEqual(
      ok("session.token"),
    );
  });

  it("returns AuthenticationError when user_token is missing", () => {
    expect(strategy.extract({ body: {} })).toEqual(
      err(new AuthenticationError()),
    );
  });
});
