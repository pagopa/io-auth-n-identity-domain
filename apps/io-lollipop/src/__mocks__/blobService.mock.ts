import { vi } from "vitest";
import { BlobClient, BlobServiceClient, BlockBlobClient, ContainerClient } from "@azure/storage-blob";


export const blobClientMock = ({
  exists: vi.fn(),
  download: vi.fn()
} as unknown as BlobClient);

export const blockBlobClientMock = ({
  exists: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
} as unknown as BlockBlobClient);

export const containerClientMock = ({
  getBlobClient: vi.fn(() => blobClientMock),
  getBlockBlobClient: vi.fn(() => blockBlobClientMock)
} as unknown as ContainerClient);

export const blobServiceClientMock = ({
  getContainerClient: vi.fn(() => containerClientMock)
} as unknown as BlobServiceClient);
