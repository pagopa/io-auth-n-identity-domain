import { vi } from "vitest";
import { BlobServiceClient } from "@azure/storage-blob";

export const doesBlobExistMock = vi.fn((_, __, callback) =>
  callback(undefined, { exists: false })
);

export const blobServiceMock = ({
  
}) as BlobServiceClient;
