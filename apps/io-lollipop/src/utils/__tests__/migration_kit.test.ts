import { describe, it, expect, beforeEach, vi } from "vitest";
import * as E from "fp-ts/Either";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import {
    BlobClientWithFallback,
    BlockBlobClientWithFallback
} from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
    buildBlobClientWithFallback,
    buildBlockBlobClientWithFallback
} from "../migration_kit";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";
import { blobServiceClientMock, containerClientMock } from "../../__mocks__/blobService.mock";



export const fallbackContainerClientMock = vi.mocked<ContainerClient>({
    getBlobClient: vi.fn(),
    getBlockBlobClient: vi.fn(),
} as unknown as ContainerClient);

export const fallbackBlobServiceClientMock = vi.mocked<BlobServiceClient>({
    getContainerClient: vi.fn(() => fallbackContainerClientMock)
} as unknown as BlobServiceClient);


const validBlobName = "my-blob.txt" as AssertionFileName;
const containerName = "primary" as NonEmptyString;
const fallbackContainerName = "fallback" as NonEmptyString;

describe("BlobClient builders", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("builds BlobClientWithFallback successfully", async () => {
        const result = await
            buildBlobClientWithFallback(
                blobServiceClientMock,
                containerName,
                fallbackBlobServiceClientMock,
                fallbackContainerName,
                validBlobName
            )();

        expect(E.isRight(result)).toBe(true);
        expect(result).toMatchObject(
            E.right(expect.any(BlobClientWithFallback))
        );

        expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledExactlyOnceWith(containerName);
        expect(fallbackBlobServiceClientMock.getContainerClient).toHaveBeenCalledExactlyOnceWith(fallbackContainerName);

        expect(containerClientMock.getBlobClient).toHaveBeenCalledExactlyOnceWith(validBlobName);
        expect(fallbackContainerClientMock.getBlobClient).toHaveBeenCalledExactlyOnceWith(validBlobName);

        expect(containerClientMock.getBlockBlobClient).not.toHaveBeenCalled();
        expect(fallbackContainerClientMock.getBlockBlobClient).not.toHaveBeenCalled();
    });

    it("returns InternalError when blob name is invalid", async () => {
        const invalidBlobName = "" as AssertionFileName;

        const result = await
            buildBlobClientWithFallback(
                blobServiceClientMock,
                containerName,
                fallbackBlobServiceClientMock,
                fallbackContainerName,
                invalidBlobName
            )();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(
            E.left({
                kind: "Internal",
                message: expect.stringContaining("invalid blob name")
            })
        );
    });


    it("builds BlockBlobClientWithFallback successfully", async () => {
        const result = await buildBlockBlobClientWithFallback(
            blobServiceClientMock,
            containerName,
            fallbackBlobServiceClientMock,
            fallbackContainerName,
            validBlobName
        )();

        expect(E.isRight(result)).toBe(true);
        expect(result).toMatchObject(
            E.right(expect.any(BlockBlobClientWithFallback))
        );

        expect(blobServiceClientMock.getContainerClient).toHaveBeenCalledExactlyOnceWith(containerName);
        expect(fallbackBlobServiceClientMock.getContainerClient).toHaveBeenCalledExactlyOnceWith(fallbackContainerName);

        expect(containerClientMock.getBlockBlobClient).toHaveBeenCalledExactlyOnceWith(validBlobName);
        expect(fallbackContainerClientMock.getBlockBlobClient).toHaveBeenCalledExactlyOnceWith(validBlobName);

        expect(containerClientMock.getBlobClient).not.toHaveBeenCalled();
        expect(fallbackContainerClientMock.getBlobClient).not.toHaveBeenCalled();
    });

    it("returns InternalError for invalid blob name (BlockBlob)", async () => {
        const invalidBlobName = "" as AssertionFileName;

        const result = await
            buildBlockBlobClientWithFallback(
                blobServiceClientMock,
                containerName,
                fallbackBlobServiceClientMock,
                fallbackContainerName,
                invalidBlobName
            )();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(
            E.left({
                kind: "Internal",
                message: expect.stringContaining("invalid blob name")
            })
        );
    });
});
