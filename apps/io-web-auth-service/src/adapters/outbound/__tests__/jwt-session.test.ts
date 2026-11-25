import { generateKeyPairSync, KeyObject } from "node:crypto";

import {
  AuthenticationError,
  FiscalCode,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import { decodeJwt, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActiveSession } from "../../../domain/entitites/active-session.entity.js";
import { PositiveInteger } from "../../../domain/value-objects/positive-integer.vo.js";
import { JwtSessionAdapter } from "../jwt-session.js";

const ISSUER = "an-issuer" as NonEmptyString;
const TTL = 3600 as PositiveInteger;

const aSession: ActiveSession = {
  name: "Mario" as NonEmptyString,
  family_name: "Rossi" as NonEmptyString,
  fiscal_number: "AAAAAA00A00A000A" as FiscalCode,
  spid_level: "https://www.spid.gov.it/SpidL2",
};

const newKey = (): KeyObject =>
  generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

const privateKey = newKey();
const adapter = new JwtSessionAdapter(privateKey, ISSUER, TTL);

describe("JwtSessionAdapter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("issues a JWT carrying session data, issuer, jti and expiration", async () => {
      const token = (await adapter.create(aSession))._unsafeUnwrap();

      const claims = decodeJwt(token);
      expect(claims).toMatchObject({ ...aSession, iss: ISSUER });
      expect(claims.jti).toMatch(/^[0-9a-f]{32}$/);
      expect(claims.exp).toBe((claims.iat as number) + TTL);
    });

    it("issues a different jti for each token", async () => {
      const a = decodeJwt((await adapter.create(aSession))._unsafeUnwrap());
      const b = decodeJwt((await adapter.create(aSession))._unsafeUnwrap());

      expect(a.jti).not.toBe(b.jti);
    });

    it("returns a GenericError when signing fails", async () => {
      const failing = new JwtSessionAdapter(privateKey, ISSUER, TTL, "HS256");

      const error = (await failing.create(aSession))._unsafeUnwrapErr();

      expect(error.kind).toBe("GenericError");
      expect(error.message).toContain("Unable to sign session JWT");
    });
  });

  describe("check", () => {
    it("accepts a token created by the adapter and returns its metadata and user", async () => {
      const token = (await adapter.create(aSession))._unsafeUnwrap();
      const claims = decodeJwt(token);

      expect((await adapter.check(token))._unsafeUnwrap()).toEqual({
        metadata: {
          expiresAtSeconds: claims.exp as number,
          id: claims.jti,
        },
        user: aSession,
      });
    });

    it("rejects a token without the jti claim", async () => {
      const token = await new SignJWT({ ...aSession })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer(ISSUER)
        .setExpirationTime("1h")
        .sign(privateKey);

      expect(
        (await adapter.check(token as NonEmptyString))._unsafeUnwrapErr(),
      ).toBeInstanceOf(AuthenticationError);
    });

    it("rejects a token signed with a different key", async () => {
      const other = new JwtSessionAdapter(newKey(), ISSUER, TTL);
      const token = (await other.create(aSession))._unsafeUnwrap();

      expect((await adapter.check(token))._unsafeUnwrapErr()).toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects a token with a different issuer", async () => {
      const other = new JwtSessionAdapter(
        privateKey,
        "another-issuer" as NonEmptyString,
        TTL,
      );
      const token = (await other.create(aSession))._unsafeUnwrap();

      expect((await adapter.check(token))._unsafeUnwrapErr()).toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects an expired token", async () => {
      const token = (await adapter.create(aSession))._unsafeUnwrap();
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + (TTL + 1) * 1000);

      expect((await adapter.check(token))._unsafeUnwrapErr()).toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects a token without the exp claim", async () => {
      const token = await new SignJWT({ ...aSession })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer(ISSUER)
        .sign(privateKey);

      expect(
        (await adapter.check(token as NonEmptyString))._unsafeUnwrapErr(),
      ).toBeInstanceOf(AuthenticationError);
    });

    it("rejects a token signed with a different algorithm", async () => {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "RS512" })
        .setIssuer(ISSUER)
        .sign(privateKey);

      expect(
        (await adapter.check(token as NonEmptyString))._unsafeUnwrapErr(),
      ).toBeInstanceOf(AuthenticationError);
    });

    it("rejects a malformed token", async () => {
      expect(
        (await adapter.check("example" as NonEmptyString))._unsafeUnwrapErr(),
      ).toBeInstanceOf(AuthenticationError);
    });
  });
});
