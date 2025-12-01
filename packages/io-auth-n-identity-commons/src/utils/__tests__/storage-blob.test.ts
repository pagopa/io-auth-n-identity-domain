import { Readable } from "stream";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import {
  BlobClient,
  BlobDownloadResponseParsed,
  BlobServiceClient,
  BlockBlobClient,
  BlockBlobUploadOptions,
  BlockBlobUploadResponse,
  ContainerClient,
  RestError,
} from "@azure/storage-blob";
import {
  blobExists,
  downloadBlob,
  getBlobAsText,
  streamToText,
  upsertBlobFromText,
} from "../storage-blob";

// ===============================
// CONSTANTS AND TEST DATA
// ===============================
const CONTAINER_NAME = "test-container";
const BLOB_NAME = "test-blob.txt";

const CHUNKS = ["This ", "is ", "a ", "test ", "blob."];
const CONTENT = CHUNKS.join("");

const SHOULD_RETURN_O_NONE_ON_NOT_FOUND_REST_ERROR =
  "should return a None on missing blob";

// ===============================
// ERROR DEFINITIONS
// ===============================
const BLOB_NOT_FOUND_REST_ERROR = new RestError(
  "The specified blob does not exist.",
  {
    statusCode: 404,
    code: "BlobNotFound",
  },
);

// ===============================
// MOCKED AZURE CLIENTS
// ===============================
const blobClientMock = vi.mocked<BlobClient>({
  exists: vi.fn(),
  download: vi.fn(),
  downloadToBuffer: vi.fn(),
} as unknown as BlobClient);

const blockBlobClientMock = vi.mocked<BlockBlobClient>({
  upload: vi.fn(),
} as unknown as BlockBlobClient);

const containerClientMock = vi.mocked<ContainerClient>({
  getBlobClient: vi.fn(() => blobClientMock),
  getBlockBlobClient: vi.fn(() => blockBlobClientMock),
} as unknown as ContainerClient);

const blobServiceClientMock = vi.mocked<BlobServiceClient>({
  getContainerClient: vi.fn(() => containerClientMock),
} as unknown as BlobServiceClient);

// ===============================
// TEST SUITES
// ===============================

describe("streamToText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const STREAM_FAILURE_MESSAGE = "stream fail";

  it("should read stream successfully", async () => {
    const stream = Readable.from(CHUNKS);
    const result = await streamToText(stream)();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(CONTENT));
  });

  it("should handle async generator stream error", async () => {
    const stream = Readable.from(
      // eslint-disable-next-line require-yield
      (async function* () {
        throw new Error(STREAM_FAILURE_MESSAGE);
      })(),
    );
    const result = await streamToText(stream)();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(E.left(Error(STREAM_FAILURE_MESSAGE)));
  });

  it("should handle Readable.destroy error", async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error(STREAM_FAILURE_MESSAGE));
      },
    });
    const result = await streamToText(stream)();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(E.left(Error(STREAM_FAILURE_MESSAGE)));
  });
});

describe("blobExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when blob exists", async () => {
    blobClientMock.exists.mockResolvedValue(true);

    const result = await blobExists(
      blobServiceClientMock,
      CONTAINER_NAME,
      BLOB_NAME,
    )();

    expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledWith(
      CONTAINER_NAME,
    );
    expect(containerClientMock.getBlobClient).toHaveBeenCalledWith(BLOB_NAME);
    expect(blobClientMock.exists).toHaveBeenCalledOnce();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(true));
  });

  it("should return false when blob does not exist", async () => {
    blobClientMock.exists.mockResolvedValue(false);

    const result = await blobExists(
      blobServiceClientMock,
      CONTAINER_NAME,
      BLOB_NAME,
    )();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(false));
  });

  it("should return an Error on failure", async () => {
    const error = new Error("Network down");
    blobClientMock.exists.mockRejectedValue(error);

    const result = await blobExists(
      blobServiceClientMock,
      CONTAINER_NAME,
      BLOB_NAME,
    )();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(E.left(error));
  });
});

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should download blob successfully", async () => {
    const readable = Readable.from(CHUNKS);
    blobClientMock.download.mockResolvedValue({
      readableStreamBody: readable,
    } as unknown as BlobDownloadResponseParsed);

    const result = await pipe(
      downloadBlob(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();

    expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledWith(
      CONTAINER_NAME,
    );
    expect(containerClientMock.getBlobClient).toHaveBeenCalledWith(BLOB_NAME);
    expect(blobClientMock.download).toHaveBeenCalledOnce();
    expect(blobClientMock.downloadToBuffer).not.toHaveBeenCalled();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(O.some(readable)));
  });

  it(SHOULD_RETURN_O_NONE_ON_NOT_FOUND_REST_ERROR, async () => {
    blobClientMock.download.mockRejectedValue(BLOB_NOT_FOUND_REST_ERROR);

    const result = await pipe(
      downloadBlob(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(O.none));
  });

  it("should return an Error with specific message on undefined ReadableStream", async () => {
    blobClientMock.download.mockResolvedValue({
      readableStreamBody: undefined,
    } as unknown as BlobDownloadResponseParsed);

    const result = await pipe(
      downloadBlob(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(
      E.left(Error("Blob stream is null or undefined")),
    );
  });
});

describe("getBlobAsText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should download and read blob successfully", async () => {
    const mockStream = Readable.from(CHUNKS);
    blobClientMock.download.mockResolvedValue({
      readableStreamBody: mockStream,
    } as unknown as BlobDownloadResponseParsed);

    const result = await pipe(
      getBlobAsText(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();

    expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledWith(
      CONTAINER_NAME,
    );
    expect(containerClientMock.getBlobClient).toHaveBeenCalledWith(BLOB_NAME);
    expect(blobClientMock.download).toHaveBeenCalledOnce();
    expect(blobClientMock.downloadToBuffer).not.toHaveBeenCalled();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(O.some(CONTENT)));
  });

  it(SHOULD_RETURN_O_NONE_ON_NOT_FOUND_REST_ERROR, async () => {
    blobClientMock.download.mockRejectedValue(BLOB_NOT_FOUND_REST_ERROR);

    const result = await pipe(
      getBlobAsText(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();
    expect(blobClientMock.download).toHaveBeenCalledOnce();
    expect(blobClientMock.downloadToBuffer).not.toHaveBeenCalled();

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(O.none));
  });

  it("should return an Error on failures", async () => {
    const error = new Error("Something went wrong");
    blobClientMock.download.mockRejectedValue(error);

    const result = await pipe(
      getBlobAsText(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(E.left(Error("Something went wrong")));
  });

  it("should return an error on undefined readableStreamBody", async () => {
    blobClientMock.download.mockResolvedValue({
      readableStreamBody: undefined,
      _response: {} as unknown,
    } as unknown as BlobDownloadResponseParsed);

    const result = await pipe(
      getBlobAsText(blobServiceClientMock, CONTAINER_NAME)(BLOB_NAME),
    )();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(
      E.left(Error("Blob stream is null or undefined")),
    );
  });
});

describe("upsertBlobFromText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload text successfully", async () => {
    blockBlobClientMock.upload.mockResolvedValue(
      {} as unknown as BlockBlobUploadResponse,
    );

    const result = await upsertBlobFromText(
      blobServiceClientMock,
      CONTAINER_NAME,
      BLOB_NAME,
      "content",
    )();

    expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledWith(
      CONTAINER_NAME,
    );
    expect(containerClientMock.getBlockBlobClient).toHaveBeenCalledWith(
      BLOB_NAME,
    );
    expect(blockBlobClientMock.upload).toHaveBeenCalledWith(
      "content",
      "content".length,
      undefined, // No options provided
    );

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(undefined));
  });

  it("should upload text successfully with the provided options", async () => {
    blockBlobClientMock.upload.mockResolvedValue(
      {} as unknown as BlockBlobUploadResponse,
    );
    const options: BlockBlobUploadOptions = {
      metadata: { author: "tester" },
    };

    const result = await upsertBlobFromText(
      blobServiceClientMock,
      CONTAINER_NAME,
      BLOB_NAME,
      "content",
      options,
    )();

    expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledWith(
      CONTAINER_NAME,
    );
    expect(containerClientMock.getBlockBlobClient).toHaveBeenCalledWith(
      BLOB_NAME,
    );
    expect(blockBlobClientMock.upload).toHaveBeenCalledWith(
      "content",
      "content".length,
      options,
    );

    expect(E.isRight(result)).toBe(true);
    expect(result).toMatchObject(E.right(undefined));
  });

  it("should return an error on upload failure", async () => {
    blockBlobClientMock.upload.mockRejectedValue(new Error("upload failed"));

    const result = await upsertBlobFromText(
      blobServiceClientMock,
      CONTAINER_NAME,
      BLOB_NAME,
      "content",
    )();

    expect(blockBlobClientMock.upload).toHaveBeenCalledWith(
      "content",
      "content".length,
      undefined,
    );

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(E.left(Error("upload failed")));
  });
});
