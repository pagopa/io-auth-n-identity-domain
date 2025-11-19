import { Readable } from "stream";
import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import {
  BlobClient,
  BlobDownloadResponseParsed,
  BlobServiceClient,
  BlobUploadCommonResponse,
  BlockBlobClient,
  ContainerClient,
} from "@azure/storage-blob";
import {
  blobExists,
  getBlobAsText,
  streamToText,
  upsertBlobFromText,
} from "../storage-blob";

describe("BlobUtil", () => {
  const mockBlobServiceClient = {
    getContainerClient: vi.fn(),
  } as unknown as Mocked<BlobServiceClient>;

  const mockContainerClient = {
    getBlobClient: vi.fn(),
    getBlockBlobClient: vi.fn(),
  } as unknown as Mocked<ContainerClient>;

  const mockBlobClient = {
    exists: vi.fn(),
    download: vi.fn(),
  } as unknown as Mocked<BlobClient>;

  const mockBlockBlobClient = {
    upload: vi.fn(),
  } as unknown as Mocked<BlockBlobClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBlobServiceClient.getContainerClient.mockReturnValue(
      mockContainerClient,
    );
    mockContainerClient.getBlobClient.mockReturnValue(mockBlobClient);
    mockContainerClient.getBlockBlobClient.mockReturnValue(mockBlockBlobClient);
  });

  describe("streamToText", () => {
    it("should read stream successfully", async () => {
      const stream = Readable.from(["blob ", "content"]);
      const result = await streamToText(stream)();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right("blob content"));
    });

    it("should handle stream error", async () => {
      const stream = new Readable({
        read() {
          this.destroy(new Error("stream fail"));
        },
      });
      const result = await streamToText(stream)();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(E.left(Error("stream fail")));
    });
  });

  describe("blobExists", () => {
    it("should return true when blob exists", async () => {
      mockBlobClient.exists.mockResolvedValue(true);

      const result = await blobExists(
        mockBlobServiceClient,
        "container",
        "blob",
      )();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right(true));
    });

    it("should map errors to InternalError", async () => {
      mockBlobClient.exists.mockRejectedValue(new Error("network down"));

      const result = await blobExists(
        mockBlobServiceClient,
        "container",
        "blob",
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(E.left(Error("network down")));
    });
  });

  describe("getBlobAsText", () => {
    it("should download and read blob successfully", async () => {
      const mockStream = Readable.from(["blob", " ", "content"]);
      mockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockStream,
      } as unknown as BlobDownloadResponseParsed);

      const result = await pipe(
        getBlobAsText(mockBlobServiceClient, "container")("blob"),
      )();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right("blob content"));
    });

    it("should return an error on missing blob", async () => {
      const error = new Error("The specified blob does not exist.");
      mockBlobClient.download.mockRejectedValue(error);

      const result = await pipe(
        getBlobAsText(mockBlobServiceClient, "container")("blob"),
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(
        E.left(Error("The specified blob does not exist.")),
      );
    });

    it("should return an error on undefined readableStreamBody", async () => {
      mockBlobClient.download.mockResolvedValue({
        readableStreamBody: undefined,
      } as unknown as BlobDownloadResponseParsed);

      const result = await pipe(
        getBlobAsText(mockBlobServiceClient, "container")("blob"),
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(
        E.left(Error("Blob stream is null or undefined")),
      );
    });
  });

  describe("upsertBlobFromText", () => {
    it("should upload text successfully", async () => {
      mockBlockBlobClient.uploadData.mockResolvedValue(
        {} as unknown as BlobUploadCommonResponse,
      );

      const result = await upsertBlobFromText(
        mockBlobServiceClient,
        "container",
        "blob",
        "content",
      )();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right(undefined));
    });

    it("should map upload errors to InternalError", async () => {
      mockBlockBlobClient.uploadData.mockRejectedValue(
        new Error("upload failed"),
      );

      const result = await upsertBlobFromText(
        mockBlobServiceClient,
        "container",
        "blob",
        "content",
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(E.left(Error("upload failed")));
    });
  });
});
