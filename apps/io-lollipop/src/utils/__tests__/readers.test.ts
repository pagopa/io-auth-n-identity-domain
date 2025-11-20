import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorResponse } from "@azure/cosmos";

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
import { blobServiceClientMock } from "../../__mocks__/blobService.mock";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";
import { toInternalError, toNotFoundError } from "../errors";
import * as BlobUtils from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
import { RestError } from "@azure/storage-blob";

// --------------------------
// Mocks
// --------------------------
vi.mock("@pagopa/io-auth-n-identity-commons/utils/storage-blob", async () => ({
  getBlobToBufferAsText: vi.fn()
}));

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
  const mockBlobServiceClient = blobServiceClientMock;
  const containerName = "container-name" as NonEmptyString;
  const assertionFileName = "assertion1.txt" as AssertionFileName;
  const assertion = "some assertion text" as NonEmptyString;

  const reader = getAssertionReader(mockBlobServiceClient, containerName);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("it should return the blob content when not empty", async () => {
    const innerMock = vi.fn().mockReturnValue(TE.right(assertion))
    vi.mocked(BlobUtils.getBlobToBufferAsText).mockReturnValue(innerMock);

    const result = await reader(assertionFileName)();

    expect(result).toEqual(E.right(assertion));
    expect(BlobUtils.getBlobToBufferAsText).toHaveBeenCalledWith(
      mockBlobServiceClient,
      containerName
    );
    expect(innerMock).toHaveBeenCalledWith(assertionFileName);
  });

  it("it should fail if the blob content is empty", async () => {
    vi.mocked(BlobUtils.getBlobToBufferAsText).mockReturnValue(
      vi.fn().mockReturnValue(TE.right("" as NonEmptyString))
    );

    const result = await reader(assertionFileName)();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toEqual(E.left(toInternalError("Assertion is empty")));
  });

  it("it should fail if getBlobToBufferAsText returns a Not Found error", async () => {
    const err = new RestError("Blob not found", { statusCode: 404 });
    vi.mocked(BlobUtils.getBlobToBufferAsText).mockReturnValue(
      vi.fn().mockReturnValue(TE.left(err))
    );

    const result = await reader(assertionFileName)();

    expect(result).toEqual(E.left(toNotFoundError()));
  });

  it("it should fail if getBlobToBufferAsText fails", async () => {
    const err = new Error("Generic error");
    vi.mocked(BlobUtils.getBlobToBufferAsText).mockReturnValue(
      vi.fn().mockReturnValue(TE.left(err))
    );

    const result = await reader(assertionFileName)();

    expect(result).toEqual(E.left(toInternalError(`Unable to get assertion blob as text: ${err.message}`, "Unable to get assertion blob as text")));
  });
});
