import { BlobService } from "azure-storage";

export const doesBlobExistMock = jest.fn((_, __, callback) =>
  callback(undefined, { exists: false })
);

export const blobServiceMock = ({
  doesBlobExist: doesBlobExistMock
} as unknown) as BlobService;
