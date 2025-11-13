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
import { blobServiceMock } from "../../__mocks__/blobService.mock";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";

import * as blobUtils from "../blob";
import { toInternalError } from "../errors";

// --------------------------
// Mocks
// --------------------------
vi.mock("../blob", async () => ({
  blobExists: vi.fn(),
  getBlobAsText: vi.fn()
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
  const mockBlobServiceClient = blobServiceMock;
  const containerName = "container-name" as NonEmptyString;
  const assertionFileName = "assertion1.txt" as AssertionFileName;
  const assertion = "some assertion text" as NonEmptyString;

  const reader = getAssertionReader(mockBlobServiceClient, containerName);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("it should return the blob content when not empty", async () => {
    const innerMock = vi.fn().mockReturnValue(TE.right(assertion))
    vi.mocked(blobUtils.getBlobAsText).mockReturnValue(innerMock);

    const result = await reader(assertionFileName)();

    expect(result).toEqual(E.right(assertion));
    expect(blobUtils.getBlobAsText).toHaveBeenCalledWith(
      mockBlobServiceClient,
      containerName
    );
    expect(innerMock).toHaveBeenCalledWith(assertionFileName);
  });

  it("it should fail if the blob content is empty", async () => {
    vi.mocked(blobUtils.getBlobAsText).mockReturnValue(
      vi.fn().mockReturnValue(TE.right("" as NonEmptyString))
    );

    const result = await reader(assertionFileName)();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toEqual(E.left(toInternalError("Assertion is empty")));
  });

  it("it should fail if getBlobAsText fails", async () => {
    const err = toInternalError("cannot read blob");
    vi.mocked(blobUtils.getBlobAsText).mockReturnValue(
      vi.fn().mockReturnValue(TE.left(err))
    );

    const result = await reader(assertionFileName)();

    expect(result).toEqual(E.left(err));
  });
});
