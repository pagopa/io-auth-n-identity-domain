import { createPublicKey, KeyObject, randomBytes } from "node:crypto";

import {
  AuthenticationError,
  GenericError,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import { errors, jwtVerify, SignJWT } from "jose";
import { err, ok, Result } from "neverthrow";

import { ActiveSession } from "../../domain/entitites/active-session.entity.js";
import { SessionPort } from "../../domain/ports/outbound/session.port.js";
import { PositiveInteger } from "../../domain/value-objects/positive-integer.vo.js";

/**
 * {@link SessionPort} implementation issuing and verifying stateless
 * session tokens as JWTs signed with a private key.
 */
export class JwtSessionAdapter implements SessionPort {
  private readonly publicKey: KeyObject;

  /**
   * @param privateKey key used to sign the JWTs; the matching public key is
   * derived from it to verify them
   * @param issuer value of the `iss` claim, set on creation and enforced on
   * verification
   * @param ttlSeconds lifetime of the issued tokens, in seconds
   * @param algorithm JWS algorithm matching the private key type (defaults to RS256)
   */
  constructor(
    private readonly privateKey: KeyObject,
    private readonly issuer: NonEmptyString,
    private readonly ttlSeconds: PositiveInteger,
    private readonly algorithm: string = "RS256",
  ) {
    this.publicKey = createPublicKey(privateKey);
  }

  /**
   * Signs a new JWT with the private key, embedding the session data in the
   * payload and setting a random `jti`, issuer, issue time and expiration.
   *
   * @param data the active session data to include in the JWT payload
   */
  async create(
    data: ActiveSession,
  ): Promise<Result<NonEmptyString, GenericError>> {
    try {
      const jti = randomBytes(16).toString("hex");

      const token = await new SignJWT({ ...data })
        .setProtectedHeader({ alg: this.algorithm })
        .setIssuer(this.issuer)
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(`${this.ttlSeconds}s`)
        .sign(this.privateKey);
      return ok(token as NonEmptyString);
    } catch (cause) {
      return err(new GenericError(`Unable to sign session JWT: ${cause}`));
    }
  }

  /**
   * Verifies signature, algorithm, issuer and expiration of the given JWT.
   */
  async check(
    sessionToken: NonEmptyString,
  ): Promise<Result<void, AuthenticationError | GenericError>> {
    try {
      await jwtVerify(sessionToken, this.publicKey, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
      });
      return ok(undefined);
    } catch (cause) {
      if (cause instanceof errors.JOSEError) {
        return err(new AuthenticationError());
      }
      return err(new GenericError(`Unable to verify session JWT: ${cause}`));
    }
  }
}
