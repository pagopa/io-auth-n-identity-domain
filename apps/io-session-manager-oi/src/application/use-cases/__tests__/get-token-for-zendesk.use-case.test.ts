import {
  EmailAddressSchema,
  FiscalCodeSchema,
  GenericError,
  NonEmptyStringSchema,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import {
  SessionIdSchema,
  SpidLevelSchema,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import * as jwt from "jsonwebtoken";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserProfile } from "../../../domain/entities/profile.entity.js";
import { ProfilePort } from "../../../domain/ports/outbound/profile.port.js";
import { PositiveIntegerSchema } from "../../../domain/value-objects/positive-integer.vo.js";
import { makeGetTokenForZendeskUseCase } from "../get-token-for-zendesk.use-case.js";

const secret = NonEmptyStringSchema.parse("zendesk-secret");
const issuer = NonEmptyStringSchema.parse("io-backend");
const expiration = PositiveIntegerSchema.parse(1200);
const email = EmailAddressSchema.parse("user@example.com");
const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const aBaseSession: BaseSession = {
  sessionId: SessionIdSchema.parse("aValidSessionId"),
  fiscalCode,
  name: NonEmptyStringSchema.parse("Mario"),
  familyName: NonEmptyStringSchema.parse("Rossi"),
  dateOfBirth: new Date("1985-10-10"),
  spidLevel: SpidLevelSchema.parse("https://www.spid.gov.it/SpidL2"),
  spidEmail: email,
  expirationDate: new Date("2100-01-01"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};
const mockGetProfile = vi.fn();
const profilePort = {
  getProfile: mockGetProfile,
} as unknown as ProfilePort;

const getTokenForZendesk = makeGetTokenForZendeskUseCase({
  profilePort,
  config: {
    JWT_ZENDESK_SUPPORT_TOKEN_SECRET: secret,
    JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION: expiration,
    JWT_ZENDESK_SUPPORT_TOKEN_ISSUER: issuer,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("makeGetTokenForZendeskUseCase", () => {
  it("returns a signed Zendesk token for a validated profile email", async () => {
    const profile: UserProfile = {
      fiscalCode,
      email,
      isEmailValidated: true,
    };
    mockGetProfile.mockResolvedValueOnce(ok(profile));

    const result = await getTokenForZendesk({ session: aBaseSession });

    expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(jwt.verify(result.value.jwt, secret, { issuer })).toMatchObject({
      email,
      external_id: fiscalCode,
      name: `${aBaseSession.name} ${aBaseSession.familyName}`,
      iss: issuer,
    });
  });

  it.each([
    {
      description: "email not validated",
      profile: { fiscalCode, email, isEmailValidated: false },
    },
    {
      description: "email missing",
      profile: { fiscalCode, isEmailValidated: false },
    },
  ])("rejects a profile with $description", async ({ profile }) => {
    mockGetProfile.mockResolvedValueOnce(ok(profile));

    const result = await getTokenForZendesk({ session: aBaseSession });

    expect(result).toEqual(
      err(new GenericError("Zendesk support email is not validated")),
    );
  });

  it("returns an inconsistency error when the profile is not found", async () => {
    mockGetProfile.mockResolvedValueOnce(
      err(new NotFoundError("Profile", "not found")),
    );

    const result = await getTokenForZendesk({ session: aBaseSession });

    expect(result).toEqual(
      err(
        new GenericError(
          "Inconsistency: a profile for a valid token was not found",
        ),
      ),
    );
  });
});
