import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorResponse } from "@azure/cosmos";
import { BlobServiceClient } from "@azure/storage-blob";

import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

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

import * as blobUtils from "../blob";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";
import { blobServiceMock } from "../../__mocks__/blobService.mock";
import { toInternalError } from "../errors";

// --------------------------
// Mocks
// --------------------------
vi.mock("../blob", async () => ({
  blobExists: vi.fn(),
  uploadBlobFromText: vi.fn()
}));

const findLastVersionByModelIdMock = vi
  .fn()
  .mockImplementation(() =>
    TE.of(O.some(aRetrievedPendingLollipopPubKeySha256))
  );

const upsertMock = vi
  .fn()
  .mockImplementation(item => TE.of({ ...aCosmosResourceMetadata, ...item }));

const lollipopPubKeysModelMock = ({
  findLastVersionByModelId: findLastVersionByModelIdMock,
  upsert: upsertMock
} as unknown) as LolliPOPKeysModel;

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
  beforeEach(() => vi.clearAllMocks());

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
  const mockBlobServiceClient = blobServiceMock;
  const containerName = "container-name" as NonEmptyString;
  const assertionFileName = "assertion1.txt" as AssertionFileName;
  const assertion = "some assertion text" as NonEmptyString;

  const writer = getAssertionWriter(mockBlobServiceClient, containerName);

  beforeEach(() => {
    vi.clearAllMocks();
  });


  it("should write the assertion when the blob does not exist", async () => {
    vi.mocked(blobUtils.blobExists).mockReturnValue(TE.right(false));
    vi.mocked(blobUtils.uploadBlobFromText).mockReturnValue(TE.right(undefined));

    const result = await writer(assertionFileName, assertion)();

    expect(result).toEqual(E.right(true));
    expect(blobUtils.blobExists).toHaveBeenCalledWith(
      mockBlobServiceClient,
      containerName,
      assertionFileName
    );
    expect(blobUtils.uploadBlobFromText).toHaveBeenCalledWith(
      mockBlobServiceClient,
      containerName,
      assertionFileName,
      assertion
    );
  });

  it("should fail if the blob already exists", async () => {
    vi.mocked(blobUtils.blobExists).mockReturnValue(TE.right(true));

    const result = await writer(assertionFileName, assertion)();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(E.left(toInternalError("Assertion already exists")));

    expect(blobUtils.uploadBlobFromText).not.toHaveBeenCalled();
  });

  it("it should fail if blobExists returns an InternalError", async () => {
    const err = toInternalError("cannot check blob");
    vi.mocked(blobUtils.blobExists).mockReturnValue(TE.left(err));

    const result = await writer(assertionFileName, assertion)();

    expect(result).toEqual(E.left({kind: "Internal", message: err.message, detail: err.detail}));
    expect(blobUtils.uploadBlobFromText).not.toHaveBeenCalled();
  });

  it("it should fail if upsertBlobFromText fails", async () => {
    vi.mocked(blobUtils.blobExists).mockReturnValue(TE.right(false));
    const err = toInternalError("upload failed");
    vi.mocked(blobUtils.uploadBlobFromText).mockReturnValue(TE.left(err));

    const result = await writer(assertionFileName, assertion)();

    expect(result).toMatchObject(E.left({kind: "Internal", message: err.message, detail: err.detail}));
  });
});