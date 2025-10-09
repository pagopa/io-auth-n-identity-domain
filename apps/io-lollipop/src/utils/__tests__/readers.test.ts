import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorResponse } from "@azure/cosmos";
import { StorageError } from "azure-storage";

import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { LolliPOPKeysModel } from "../../model/lollipop_keys";
import { getAssertionReader, getPublicKeyDocumentReader } from "../readers";

import {
  aRetrievedPendingLollipopPubKeySha256,
  aValidSha256AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";
import { anAssertionFileName } from "../../__mocks__/lollipopkeysMock";
import { blobServiceMock } from "../../__mocks__/blobService.mock";
import { anAssertionContent } from "../../__mocks__/readers.mock";

// --------------------------
// Mocks
// --------------------------

const findLastVersionByModelIdMock = vi
  .fn()
  .mockImplementation(() =>
    TE.of(O.some(aRetrievedPendingLollipopPubKeySha256))
  );

const upsertMock = vi.fn().mockImplementation(() => TE.of({}));

const lollipopPubKeysModelMock = ({
  findLastVersionByModelId: findLastVersionByModelIdMock,
  upsert: upsertMock
} as unknown) as LolliPOPKeysModel;

const getBlobAsTextMock = vi
  .fn()
  .mockImplementation(() => TE.of(O.some(anAssertionContent)));

vi.mock("@pagopa/azure-storage-legacy-migration-kit", async () => {
  const actual: object = await vi.importActual(
    "@pagopa/azure-storage-legacy-migration-kit"
  );
  return {
    ...actual,
    getBlobAsText: (...args: unknown[]) => getBlobAsTextMock(...args)
  };
});
// --------------------------
// Tests
// --------------------------

describe("PublicKeyDocumentReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return the existing popDocument", async () => {
    const publicKeyDocumentReader = getPublicKeyDocumentReader(
      lollipopPubKeysModelMock
    );

    const result = await publicKeyDocumentReader(aValidSha256AssertionRef)();
    expect(result).toEqual(E.right(aRetrievedPendingLollipopPubKeySha256));
  });

  it("should return NotFound if document does not exists", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() => TE.of(O.none));
    const publicKeyDocumentReader = getPublicKeyDocumentReader(
      lollipopPubKeysModelMock
    );

    const result = await publicKeyDocumentReader(aValidSha256AssertionRef)();
    expect(result).toMatchObject(
      E.left({
        kind: "NotFound"
      })
    );
  });

  it("should return InternalError if an error occurred retrieving the document", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left({
        kind: "COSMOS_ERROR_RESPONSE",
        error: { message: "an Error" } as ErrorResponse
      })
    );
    const publicKeyDocumentReader = getPublicKeyDocumentReader(
      lollipopPubKeysModelMock
    );

    const result = await publicKeyDocumentReader(aValidSha256AssertionRef)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: "Error retrieving pubKey document",
        message: 'Generic error: {"message":"an Error"}'
      })
    );
  });
});

describe("AssertionReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return the existing assertion", async () => {
    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();

    expect(getBlobAsTextMock).toHaveBeenCalledWith(
      expect.any(Object),
      "aContainerName",
      anAssertionFileName
    );
    expect(result).toEqual(E.right(anAssertionContent));
  });

  it("should return an internal error when an error occurred retrieving the assertion from blob storage", async () => {
    getBlobAsTextMock.mockImplementationOnce(
      () => TE.left(({ message: "an Error" } as unknown) as StorageError)
    );

    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: "Unable to retrieve assertion",
        message: `Unable to retrieve assertion from blob storage: an Error`
      })
    );
  });

  it("should return an internal error when the assertion content is empty", async () => {
    getBlobAsTextMock.mockImplementationOnce(
      () => TE.right(O.some(""))
    );

    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: `Assertion is empty`,
        message: "Assertion is empty"
      })
    );
  });

  it("should return a not found error when there no assertion was found in blob storage for a given assertion file name", async () => {
    getBlobAsTextMock.mockImplementationOnce(
      () => TE.right(O.none)
    );

    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(
      E.left({
        kind: "NotFound"
      })
    );
  });
});
