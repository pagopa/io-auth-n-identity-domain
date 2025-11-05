import { vi } from "vitest";
import { BlobServiceClient } from "@azure/storage-blob";
import { Readable } from "stream";

export const doesBlobExistMock = vi.fn(async () => true);

export const readBlobMock = vi.fn(async () => ({
  readableStreamBody: Readable.from(["mocked blob content"])
}));

export const uploadBlobMock = vi.fn(async () => ({ etag: "anEtag" }));

export const blockBlobClientMock = {
  exists: doesBlobExistMock,
  download: readBlobMock,
  uploadData: uploadBlobMock,
};

export const blobServiceMock = ({
  getContainerClient: () => ({
    getBlockBlobClient: () => blockBlobClientMock
  })
}) as unknown as BlobServiceClient;
