import { describe, it, expect, vi, beforeEach } from "vitest";
import * as E from "fp-ts/Either";
import { Readable } from "stream";
import {
  blobExists,
  getBlobAsText,
  upsertBlobFromText
} from "../blob";
import { toInternalError, toNotFoundError } from "../errors";
import { pipe } from "fp-ts/lib/function";

describe("blobUtils", () => {
  const mockBlobServiceClient = {
    getContainerClient: vi.fn()
  } as any;

  const mockContainerClient = {
    getBlobClient: vi.fn(),
    getBlockBlobClient: vi.fn()
  } as any;

  const mockBlobClient = {
    exists: vi.fn(),
    download: vi.fn()
  } as any;

  const mockBlockBlobClient = {
    uploadData: vi.fn()
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBlobServiceClient.getContainerClient.mockReturnValue(
      mockContainerClient
    );
    mockContainerClient.getBlobClient.mockReturnValue(mockBlobClient);
    mockContainerClient.getBlockBlobClient.mockReturnValue(mockBlockBlobClient);
  });

  describe("streamToText", () => {
    it("should read stream successfully", async () => {
      const stream = Readable.from(["hello ", "world"]);
      const result = await streamToText(stream)();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right("hello world"));
    });

    it("should handle stream error", async () => {
      const stream = new Readable({
        read() {
          this.destroy(new Error("stream fail"));
        }
      });
      const result = await streamToText(stream)();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(
        E.left(
          toInternalError(
            expect.stringContaining("stream fail"),
            expect.any(String)
          )
        )
      );
    });
  });

  describe("blobExists", () => {
    it("should return true when blob exists", async () => {
      mockBlobClient.exists.mockResolvedValue(true);

      const result = await blobExists(
        mockBlobServiceClient,
        "container",
        "blob"
      )();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right(true));
    });

    it("should map errors to InternalError", async () => {
      mockBlobClient.exists.mockRejectedValue(new Error("network down"));

      const result = await blobExists(
        mockBlobServiceClient,
        "container",
        "blob"
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(
        E.left(
          toInternalError(
            "network down",
            "Error checking assertion file existence"
          )
        )
      );
    });
  });

  describe("getBlobAsText", () => {
    it("should download and read blob successfully", async () => {
      const mockStream = Readable.from(["blob content"]);
      mockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockStream
      });

      const result = await pipe(
        getBlobAsText(mockBlobServiceClient, "container")("blob")
      )();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right("blob content"));
    });

    it("should handle missing blob (NotFoundError)", async () => {
      const error = new Error("The specified blob does not exist.");
      mockBlobClient.download.mockRejectedValue(error);

      const result = await pipe(
        getBlobAsText(mockBlobServiceClient, "container")("blob")
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(E.left(toNotFoundError()));
    });

    it("should handle null readableStreamBody (InternalError)", async () => {
      mockBlobClient.download.mockResolvedValue({ readableStreamBody: null });

      const result = await pipe(
        getBlobAsText(mockBlobServiceClient, "container")("blob")
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(
        E.left(
          toInternalError(
            expect.stringContaining("Blob stream is null or undefined"),
            expect.any(String)
          )
        )
      );
    });
  });

  describe("upsertBlobFromText", () => {
    it("should upload text successfully", async () => {
      mockBlockBlobClient.uploadData.mockResolvedValue({});

      const result = await upsertBlobFromText(
        mockBlobServiceClient,
        "container",
        "blob",
        "content"
      )();

      expect(E.isRight(result)).toBe(true);
      expect(result).toMatchObject(E.right(undefined));
    });

    it("should map upload errors to InternalError", async () => {
      mockBlockBlobClient.uploadData.mockRejectedValue(
        new Error("upload failed")
      );

      const result = await upsertBlobFromText(
        mockBlobServiceClient,
        "container",
        "blob",
        "content"
      )();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toMatchObject(
        E.left(
          toInternalError(
            "upload failed",
            "Error saving assertion file on blob storage"
          )
        )
      );
    });
  });
});
