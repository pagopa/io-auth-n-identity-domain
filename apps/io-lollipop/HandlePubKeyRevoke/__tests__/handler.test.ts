import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import { handleRevoke } from "../handler";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  NotPendingLolliPopPubKeys,
  PendingLolliPopPubKeys
} from "../../model/lollipop_keys";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import { AssertionTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import * as jose from "jose";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";

const contextMock = {
  log: {
    error: jest.fn()
  },
  executionContext: { retryContext: { retryCount: 1, maxRetryCount: 5 } }
} as any;

const mockAppinsights = {
  trackEvent: jest.fn().mockReturnValue(void 0),
  trackException: jest.fn().mockReturnValue(void 0)
};

const aValidAssertionRef = "sha256-9f86d081884c7d659a2feaa0c55ad015a3bf4f1234" as AssertionRef;
const aValidSha512AssertionRef = "sha512-9f86d081884c7d659a2feaa0c55ad015a3bf4f1234abcdaacabac8734623984f" as AssertionRef;

const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;
const aValidRevokeInput: RevokeAssertionRefInfo = {
  assertion_ref: aValidAssertionRef
};

const aValidJwk: JwkPublicKey = {
  kty: "EC",
  crv: "P-256",
  x: "SVqB4JcUD6lsfvqMr-OKUNUphdNn64Eay60978ZlL74",
  y: "lf0u0pMj4lGAzZix5u4Cm5CMQIgMNpkwy163wtKYVKI"
};

const anInvalidJwk: JwkPublicKey = {
  alg: "",
  e: "e",
  kty: "RSA",
  n: ""
};
const toEncodedJwk = (jwk: JwkPublicKey) =>
  jose.base64url.encode(JSON.stringify(jwk)) as NonEmptyString;

const aPendingLollipopPubKey: PendingLolliPopPubKeys = {
  assertionRef: aValidAssertionRef,
  pubKey: toEncodedJwk(aValidJwk),
  status: PubKeyStatusEnum.PENDING
};

const aNotPendingLollipopPubKey: NotPendingLolliPopPubKeys = {
  ...aPendingLollipopPubKey,
  assertionFileName: `${aFiscalCode}-${aValidAssertionRef}` as AssertionFileName,
  assertionType: AssertionTypeEnum.SAML,
  fiscalCode: aFiscalCode,
  expiredAt: new Date(),
  status: PubKeyStatusEnum.VALID
};

const findLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some({})));

const upsertMock = jest.fn().mockImplementation(() => TE.of({}));
const lollipopKeysModelMock = {
  findLastVersionByModelId: findLastVersionByModelIdMock,
  upsert: upsertMock
} as any;

const masterAlgo = JwkPubKeyHashAlgorithmEnum.sha512;

describe("handleRevoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GIVEN a malformed revoke message WHEN decoding input THEN it should return a Permanent Failure", async () => {
    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      "wrong input"
    );

    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "false" },
        properties: expect.objectContaining({
          detail: "PERMANENT",
          assertionRef: "unknown",
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          maxRetryCount: "5"
        })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "PERMANENT"
      })
    );
  });

  it("GIVEN a valid revoke message WHEN findLastVersion fails THEN it should throw with a transient failure", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left(toCosmosErrorResponse("Cannot reach cosmosDB"))
    );
    await expect(
      handleRevoke(
        contextMock,
        mockAppinsights as any,
        lollipopKeysModelMock,
        masterAlgo,
        aValidRevokeInput
      )
    ).rejects.toBeDefined();

    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "true" },
        properties: expect.objectContaining({
          detail: "TRANSIENT",
          fatal: "false",
          isSuccess: "false",
          modelId: "",
          assertionRef: aValidAssertionRef,
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          maxRetryCount: "5"
        })
      })
    );
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidRevokeInput.assertion_ref
    ]);
  });

  it("GIVEN a valid revoke message WHEN findLastVersion fails the last retry THEN it should throw with a transient failure without sampling", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left(toCosmosErrorResponse("Cannot reach cosmosDB"))
    );
    await expect(
      handleRevoke(
        {
          ...contextMock,
          executionContext: {
            retryContext: { retryCount: 4, maxRetryCount: 5 }
          }
        },
        mockAppinsights as any,
        lollipopKeysModelMock,
        masterAlgo,
        aValidRevokeInput
      )
    ).rejects.toBeDefined();

    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "false" },
        properties: expect.objectContaining({
          detail: "TRANSIENT",
          fatal: "false",
          isSuccess: "false",
          modelId: "",
          assertionRef: aValidAssertionRef,
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "4",
          maxRetryCount: "5"
        })
      })
    );
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidRevokeInput.assertion_ref
    ]);
  });

  it("GIVEN a valid revoke message WHEN findLastVersion returns none THEN it should success without perform any upsert", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() => TE.right(O.none));
    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      aValidRevokeInput
    );

    expect(mockAppinsights.trackException).not.toHaveBeenCalled();
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidRevokeInput.assertion_ref
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("GIVEN a valid revoke message WHEN findLastVersion returns a PENDING lollipop pub key THEN it should success without perform any upsert", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.right(O.some(aPendingLollipopPubKey))
    );
    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      aValidRevokeInput
    );

    expect(mockAppinsights.trackException).not.toHaveBeenCalled();
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidRevokeInput.assertion_ref
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("GIVEN a valid revoke message WHEN assertionRef match a master lollipopPubKey THEN it should success performing an upsert", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.right(
        O.some({
          ...aNotPendingLollipopPubKey,
          assertionRef: aValidSha512AssertionRef
        })
      )
    );

    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      { assertion_ref: aValidSha512AssertionRef }
    );

    expect(mockAppinsights.trackException).not.toHaveBeenCalled();
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidSha512AssertionRef
    ]);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith({
      ...aNotPendingLollipopPubKey,
      assertionRef: aValidSha512AssertionRef,
      status: PubKeyStatusEnum.REVOKED
    });
    expect(result).toBeUndefined();
  });

  it("GIVEN a valid revoke message that does not match master key WHEN the related pubKey is not a valid JWK THEN it should return a Permanent Failure", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.right(
        O.some({
          ...aNotPendingLollipopPubKey,
          pubKey: "anInvalidPubKey" as NonEmptyString
        })
      )
    );

    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      aValidRevokeInput
    );

    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidAssertionRef
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "false" },
        properties: expect.objectContaining({
          detail: "PERMANENT",
          assertionRef: aValidAssertionRef,
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          maxRetryCount: "5"
        })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "PERMANENT",
        reason: expect.stringContaining("Cannot decode used jwk")
      })
    );
  });

  it("GIVEN a valid revoke message that does not match master key WHEN master key's thumbprint generation fails THEN it should return a Permanent Failure", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.right(
        O.some({
          ...aNotPendingLollipopPubKey,
          pubKey: toEncodedJwk(anInvalidJwk)
        })
      )
    );

    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      aValidRevokeInput
    );

    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidAssertionRef
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "false" },
        properties: expect.objectContaining({
          detail: "PERMANENT",
          assertionRef: aValidAssertionRef,
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          maxRetryCount: "5"
        })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "PERMANENT",
        reason: expect.stringContaining("Can not calculate JwkThumbprint ")
      })
    );
  });

  it("GIVEN a valid revoke message that does not match master key WHEN master key's find fails THEN it should return a Transient Failure", async () => {
    findLastVersionByModelIdMock
      .mockImplementationOnce(() => TE.right(O.some(aNotPendingLollipopPubKey)))
      .mockImplementationOnce(() => TE.left("NetworkError"));

    await expect(
      handleRevoke(
        contextMock,
        mockAppinsights as any,
        lollipopKeysModelMock,
        masterAlgo,
        aValidRevokeInput
      )
    ).rejects.toBeDefined();

    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(2);
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(1, [
      aValidAssertionRef
    ]);
    const expectedThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      masterAlgo
    );
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(2, [
      `${masterAlgo}-${expectedThumbprint}`
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "true" },
        properties: expect.objectContaining({
          detail: "TRANSIENT",
          assertionRef: aValidAssertionRef,
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          maxRetryCount: "5"
        })
      })
    );
  });

  it("GIVEN a valid revoke message that does not match master key WHEN master key's find returns none THEN it should return a Transient Failure", async () => {
    findLastVersionByModelIdMock
      .mockImplementationOnce(() => TE.right(O.some(aNotPendingLollipopPubKey)))
      .mockImplementationOnce(() => TE.right(O.none));

    await expect(
      handleRevoke(
        contextMock,
        mockAppinsights as any,
        lollipopKeysModelMock,
        masterAlgo,
        aValidRevokeInput
      )
    ).rejects.toBeDefined();

    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(2);
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(1, [
      aValidAssertionRef
    ]);
    const expectedThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      masterAlgo
    );
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(2, [
      `${masterAlgo}-${expectedThumbprint}`
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "true" },
        properties: expect.objectContaining({
          detail: "TRANSIENT",
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          assertionRef: aValidAssertionRef,
          maxRetryCount: "5",
          errorMessage: expect.stringContaining(
            "Cannot find a master lollipopPubKey"
          )
        })
      })
    );
  });

  it("GIVEN a valid revoke message that does not match master key WHEN master lollipopPubKey is PENDING THEN it should return a Transient Failure", async () => {
    findLastVersionByModelIdMock
      .mockImplementationOnce(() => TE.right(O.some(aNotPendingLollipopPubKey)))
      .mockImplementationOnce(() => TE.right(O.some(aPendingLollipopPubKey)));

    await expect(
      handleRevoke(
        contextMock,
        mockAppinsights as any,
        lollipopKeysModelMock,
        masterAlgo,
        aValidRevokeInput
      )
    ).rejects.toBeDefined();

    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(2);
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(1, [
      aValidAssertionRef
    ]);
    const expectedThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      masterAlgo
    );
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(2, [
      `${masterAlgo}-${expectedThumbprint}`
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        tagOverrides: { samplingEnabled: "true" },
        properties: expect.objectContaining({
          detail: "TRANSIENT",
          assertionRef: aValidAssertionRef,
          errorMessage: expect.stringContaining(
            "Cannot decode a VALID master lollipopPubKey"
          ),
          name: "lollipop.pubKeys.revoke.failure",
          retryCount: "1",
          maxRetryCount: "5"
        })
      })
    );
  });

  it("GIVEN a valid revoke message that does not match master key WHEN master lollipopPubKey is retrieved THEN it should upsert to REVOKED all pubKeys", async () => {
    findLastVersionByModelIdMock
      .mockImplementationOnce(() => TE.right(O.some(aNotPendingLollipopPubKey)))
      .mockImplementationOnce(() =>
        TE.right(
          O.some({
            ...aNotPendingLollipopPubKey,
            assertionRef: aValidSha512AssertionRef
          })
        )
      );

    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      masterAlgo,
      aValidRevokeInput
    );

    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(2);
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(1, [
      aValidAssertionRef
    ]);
    const expectedThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      masterAlgo
    );
    expect(findLastVersionByModelIdMock).toHaveBeenNthCalledWith(2, [
      `${masterAlgo}-${expectedThumbprint}`
    ]);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenNthCalledWith(1, {
      ...aNotPendingLollipopPubKey,
      assertionRef: aValidSha512AssertionRef,
      status: PubKeyStatusEnum.REVOKED
    });
    expect(upsertMock).toHaveBeenNthCalledWith(2, {
      ...aNotPendingLollipopPubKey,
      status: PubKeyStatusEnum.REVOKED
    });
    expect(mockAppinsights.trackException).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
