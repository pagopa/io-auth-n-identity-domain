import { ErrorResponse } from "@azure/cosmos";
import { BlobService } from "azure-storage";

import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import * as fn_commons from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { AssertionTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";

import {
  LolliPOPKeysModel,
  NewLolliPopPubKeys
} from "../../model/lollipop_keys";

import { getAssertionWriter, getPopDocumentWriter } from "../writers";

import {
  aCosmosResourceMetadata,
  aFiscalCode,
  aRetrievedPendingLollipopPubKeySha256,
  aRetrievedValidLollipopPubKeySha256,
  aValidJwk,
  aValidSha256AssertionRef,
  toEncodedJwk
} from "../../__mocks__/lollipopPubKey.mock";

import {
  blobServiceMock,
  doesBlobExistMock
} from "../../__mocks__/blobService.mock";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";

// --------------------------
// Mocks
// --------------------------

const findLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() =>
    TE.of(O.some(aRetrievedPendingLollipopPubKeySha256))
  );

const upsertMock = jest
  .fn()
  .mockImplementation(item => TE.of({ ...aCosmosResourceMetadata, ...item }));

const lollipopPubKeysModelMock = ({
  findLastVersionByModelId: findLastVersionByModelIdMock,
  upsert: upsertMock
} as unknown) as LolliPOPKeysModel;

const upsertBlobFromTextMock = jest.spyOn(fn_commons, "upsertBlobFromText");
upsertBlobFromTextMock.mockImplementation(async () =>
  E.right(O.fromNullable({ name: "blob" } as BlobService.BlobResult))
);

// Variables

const newDocument: NewLolliPopPubKeys = {
  assertionRef: aValidSha256AssertionRef,
  assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}` as AssertionFileName,
  assertionType: AssertionTypeEnum.SAML,
  expiredAt: new Date(),
  fiscalCode: aFiscalCode,
  pubKey: toEncodedJwk(aValidJwk),
  status: PubKeyStatusEnum.VALID,
  ttl: 900 as NonNegativeInteger
};

// --------------------------
// Tests
// --------------------------

describe("PopDocumentWriter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return the stored popDocument", async () => {
    const popDocumentWriter = getPopDocumentWriter(lollipopPubKeysModelMock);

    const result = await popDocumentWriter(newDocument)();
    expect(result).toEqual(
      E.right({
        ...aRetrievedValidLollipopPubKeySha256,
        expiredAt: newDocument.expiredAt
      })
    );
  });

  it("should return InternalError if an error occurred storing the document", async () => {
    upsert: upsertMock.mockImplementationOnce(() =>
      TE.left({
        kind: "COSMOS_ERROR_RESPONSE",
        error: { message: "an Error" } as ErrorResponse
      })
    );
    const popDocumentWriter = getPopDocumentWriter(lollipopPubKeysModelMock);

    const result = await popDocumentWriter(newDocument)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: "Error creating pubKey document",
        message: 'Generic error: {"message":"an Error"}'
      })
    );
  });
});

describe("AssertionWriter", () => {
  beforeEach(() => jest.clearAllMocks());

  const containerName = "container-name" as NonEmptyString;

  it("should return true if assertion has beed stored in blob storage", async () => {
    const assertionWriter = getAssertionWriter(blobServiceMock, containerName);

    const result = await assertionWriter(
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    )();
    expect(result).toEqual(E.right(true));

    expect(doesBlobExistMock).toHaveBeenCalled();
    expect(upsertBlobFromTextMock).toHaveBeenCalledWith(
      blobServiceMock,
      containerName,
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    );
  });

  it("should return InternalError if an error occurred storing the assertion", async () => {
    upsertBlobFromTextMock.mockImplementationOnce(() =>
      Promise.reject(Error("an Error"))
    );
    const assertionWriter = getAssertionWriter(blobServiceMock, containerName);

    const result = await assertionWriter(
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    )();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: "Error saving assertion file on blob storage",
        message: "an Error"
      })
    );
  });

  it("should return InternalError if upsertBlobFromText returns a Left object", async () => {
    upsertBlobFromTextMock.mockImplementationOnce(async () =>
      E.left(new Error("another Error"))
    );
    const assertionWriter = getAssertionWriter(blobServiceMock, containerName);

    const result = await assertionWriter(
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    )();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: "Error saving assertion file on blob storage",
        message: "another Error"
      })
    );
  });

  it("should return InternalError if upsertBlobFromText returns O.none", async () => {
    upsertBlobFromTextMock.mockImplementationOnce(async () => E.right(O.none));
    const assertionWriter = getAssertionWriter(blobServiceMock, containerName);

    const result = await assertionWriter(
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    )();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: "Can not upload blob to storage",
        message: "Can not upload blob to storage"
      })
    );
  });

  it("should return InternalError if the blob already exists", async () => {
    doesBlobExistMock.mockImplementationOnce((_, __, callback) =>
      callback(undefined, { exists: true })
    );
    const assertionWriter = getAssertionWriter(blobServiceMock, containerName);

    const result = await assertionWriter(
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    )();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: `Assertion already exists`,
        message: `Assertion already exists`
      })
    );
  });

  it("should return InternalError if doesBlobExist rejects", async () => {
    doesBlobExistMock.mockImplementationOnce((_, __, callback) =>
      callback(new Error("an Error"), undefined)
    );
    const assertionWriter = getAssertionWriter(blobServiceMock, containerName);

    const result = await assertionWriter(
      aRetrievedValidLollipopPubKeySha256.assertionFileName,
      "an Assertion"
    )();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: `Error checking assertion file existance`,
        message: `an Error`
      })
    );
  });
});
