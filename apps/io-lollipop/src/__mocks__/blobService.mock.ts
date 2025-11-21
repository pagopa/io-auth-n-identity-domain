import { vi, Mocked } from "vitest";
import { BlobClient, BlobServiceClient, BlockBlobClient, ContainerClient } from "@azure/storage-blob";


export const blobClientMock = vi.mocked<BlobClient>({
  exists: vi.fn(),
  download: vi.fn()
} as unknown as BlobClient);

export const blockBlobClientMock = vi.mocked<BlockBlobClient>({
  exists: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
} as unknown as BlockBlobClient);

export const containerClientMock = vi.mocked<ContainerClient>({
  getBlobClient: () => blobClientMock,
  getBlockBlobClient: () => blockBlobClientMock
} as unknown as ContainerClient);

export const blobServiceClientMock = vi.mocked<BlobServiceClient>({
  getContainerClient: () => containerClientMock
} as unknown as BlobServiceClient);
