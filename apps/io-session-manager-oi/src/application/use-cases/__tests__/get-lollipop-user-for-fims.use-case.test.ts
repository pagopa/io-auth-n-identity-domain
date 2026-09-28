import {
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import { ProfilePortMock } from "../../../__mocks__/ports/profile-port.mock.js";
import { aSessionWithHashedTokens } from "../../../__mocks__/session.mocks.js";
import { LollipopPort } from "../../../domain/ports/outbound/lollipop.port.js";
import { makeGetLollipopUserForFimsUseCase } from "../get-lollipop-user-for-fims.use-case.js";
import { GetUserForFimsUseCase } from "../get-user-for-fims.use-case.js";

const aSession = aSessionWithHashedTokens;
const anOperationId = "an-operation-id" as NonEmptyString;
const anAssertionRef = `sha256-${"a".repeat(43)}`;

const lollipopPortMock = {
  reservePubKey: vi.fn(),
  activatePubKey: vi.fn(),
  generateLCParams: vi.fn(),
} satisfies LollipopPort;

const getUserForFimsUseCase = vi.fn();

const getLollipopUserForFims = makeGetLollipopUserForFimsUseCase({
  profilePort: ProfilePortMock,
  lollipopPort: lollipopPortMock,
  lollipopActivationPort: lollipopActivationPortMock,
  getUserForFimsUseCase,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("makeGetLollipopUserForFimsUseCase", () => {
  it("returns the FIMS profile and generated LC params", async () => {
    const lollipopActivation = {
      fiscalCode: aSession.fiscalCode,
      assertionRef: anAssertionRef,
      expirationDate: new Date("2100-01-01"),
    };
    const lcParams = {
      assertion_ref: anAssertionRef,
      assertion_file_name: "an-assertion-file-name",
      assertion_type: "SAML",
      expired_at: "2100-01-01T00:00:00.000Z",
      fiscal_code: aSession.fiscalCode,
      pub_key: "an-encoded-jwk",
      status: "VALID",
      ttl: 1200,
      version: 1,
      lc_authentication_bearer: "a-bearer-token",
    };
    getUserForFimsUseCase.mockResolvedValueOnce(
      ok({
        name: "Mario Rossi",
        family_name: "Rossi",
        fiscal_code: aSession.fiscalCode,
        auth_time: aSession.createdAt.getTime(),
        acr: aSession.spidLevel,
        email: "mario.rossi@example.com",
        date_of_birth: "1985-10-10",
      }),
    );
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      ok(lollipopActivation),
    );
    lollipopPortMock.generateLCParams = vi
      .fn()
      .mockResolvedValueOnce(ok(lcParams));

    const result = await getLollipopUserForFims({
      session: aSession,
      operationId: anOperationId,
    });

    expect(
      lollipopActivationPortMock.getByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aSession.fiscalCode);
    expect(lollipopPortMock.generateLCParams).toHaveBeenCalledExactlyOnceWith(
      anAssertionRef,
      { operation_id: anOperationId },
    );
    expect(getUserForFimsUseCase).toHaveBeenCalledExactlyOnceWith({
      session: aSession,
    });
    expect(result).toEqual(
      ok({
        profile: expect.objectContaining({ fiscal_code: aSession.fiscalCode }),
        lc_params: {
          assertion_ref: lcParams.assertion_ref,
          pub_key: lcParams.pub_key,
          lc_authentication_bearer: lcParams.lc_authentication_bearer,
        },
      }),
    );
  });

  it("propagates a profile lookup error", async () => {
    const error = new NotFoundError("Profile", "not found");
    getUserForFimsUseCase.mockResolvedValueOnce(err(error));
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      ok({
        fiscalCode: aSession.fiscalCode,
        assertionRef: anAssertionRef,
        expirationDate: new Date("2100-01-01"),
      }),
    );
    lollipopPortMock.generateLCParams = vi.fn().mockResolvedValueOnce(ok({}));

    const result = await getLollipopUserForFims({
      session: aSession,
      operationId: anOperationId,
    });

    expect(result).toEqual(err(error));
  });

  it("propagates an activation lookup error", async () => {
    const error = new GenericError("activation not found");
    getUserForFimsUseCase.mockResolvedValueOnce(ok({} as never));
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(error),
    );

    const result = await getLollipopUserForFims({
      session: aSession,
      operationId: anOperationId,
    });

    expect(result).toEqual(err(error));
    expect(lollipopPortMock.generateLCParams).not.toHaveBeenCalled();
  });

  it("propagates an LC params generation error", async () => {
    const error = new GenericError("lollipop unavailable");
    getUserForFimsUseCase.mockResolvedValueOnce(ok({} as never));
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      ok({
        fiscalCode: aSession.fiscalCode,
        assertionRef: anAssertionRef,
        expirationDate: new Date("2100-01-01"),
      }),
    );
    lollipopPortMock.generateLCParams = vi
      .fn()
      .mockResolvedValueOnce(err(error));

    const result = await getLollipopUserForFims({
      session: aSession,
      operationId: anOperationId,
    });

    expect(result).toEqual(err(error));
  });
});
