import { vi } from "vitest";
import { BlobService } from "azure-storage";
import { BlobServiceWithFallBack } from "@pagopa/azure-storage-legacy-migration-kit";

export const doesBlobExistMock = vi.fn((_, __, callback) =>
  callback(undefined, { exists: false })
);

export const azureBlobServiceMock = ({
  doesBlobExist: doesBlobExistMock
} as unknown) as BlobService;

export const blobServiceMock = ({
  primary: azureBlobServiceMock,
  secondary: azureBlobServiceMock
} as unknown) as BlobServiceWithFallBack;
