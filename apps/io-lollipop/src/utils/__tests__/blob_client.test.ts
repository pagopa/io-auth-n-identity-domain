import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    BlobClient,
    BlockBlobClient,
    ContainerClient,
    BlobServiceClient
} from "@azure/storage-blob";
import {
    BlobClientWithFallback,
    BlockBlobClientWithFallback,
    FallbackTracker
} from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { blobClientMock, blobServiceClientMock, blockBlobClientMock } from "../../__mocks__/blobService.mock";
import {
    IBlobLocation,
    buildClientWithFallback,
    buildBlobClientWithFallback,
    buildBlockBlobClientWithFallback
} from "../blob_client";


// ===============================
// Mock helpers
// ===============================
const mockBlobClient = blobClientMock as BlobClient;
const mockBlockBlobClient = blockBlobClientMock as BlockBlobClient;

const mockServiceClient = blobServiceClientMock as BlobServiceClient;

const primaryLocation: IBlobLocation = {
    service: mockServiceClient,
    containerName: "primary" as NonEmptyString
};

const fallbackLocation: IBlobLocation = {
    service: mockServiceClient,
    containerName: "fallback" as NonEmptyString
};

const blobName = "myBlob.txt" as NonEmptyString;

describe("buildClientWithFallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should create a BlobClientWithFallback correctly", () => {
        const mockGetClient = vi.fn(() => mockBlobClient);
        const builder = buildClientWithFallback(BlobClientWithFallback, mockGetClient);
        const client = builder(primaryLocation, fallbackLocation)(blobName);

        expect(client).toBeInstanceOf(BlobClientWithFallback);
        expect(mockGetClient).toHaveBeenCalledWith(
            mockServiceClient.getContainerClient(primaryLocation.containerName),
            blobName
        );
        expect(mockGetClient).toHaveBeenCalledWith(
            mockServiceClient.getContainerClient(fallbackLocation.containerName),
            blobName
        );
    });

    it("should create a BlockBlobClientWithFallback correctly", () => {
        const mockGetClient = vi.fn(() => mockBlockBlobClient);
        const builder = buildClientWithFallback(BlockBlobClientWithFallback, mockGetClient);
        const client = builder(primaryLocation, fallbackLocation)(blobName);

        expect(client).toBeInstanceOf(BlockBlobClientWithFallback);
        expect(mockGetClient).toHaveBeenCalledWith(
            mockServiceClient.getContainerClient(primaryLocation.containerName),
            blobName
        );
        expect(mockGetClient).toHaveBeenCalledWith(
            mockServiceClient.getContainerClient(fallbackLocation.containerName),
            blobName
        );
    });
});

describe("buildBlobClientWithFallback", () => {
    it("should return a BlobClientWithFallback instance", () => {
        const client = buildBlobClientWithFallback(primaryLocation, fallbackLocation)(blobName);
        expect(client).toBeInstanceOf(BlobClientWithFallback);
    });
});

describe("buildBlockBlobClientWithFallback", () => {
    it("should return a BlockBlobClientWithFallback instance", () => {
        const client = buildBlockBlobClientWithFallback(primaryLocation, fallbackLocation)(blobName);
        expect(client).toBeInstanceOf(BlockBlobClientWithFallback);
    });
});
