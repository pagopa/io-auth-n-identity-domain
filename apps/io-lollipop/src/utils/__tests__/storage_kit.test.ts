import { describe, it, expect, beforeEach, vi } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import {
    BlobClient,
    BlobServiceClient,
    ContainerClient
} from "@azure/storage-blob";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { getBlobAsText } from "../blob";
import * as migrationKit from "../migration_kit";


const primaryBlobClientMock = vi.mocked<BlobClient>({
    exists: vi.fn(),
    downloadToBuffer: vi.fn()
} as unknown as BlobClient);

const fallbackBlobClientMock = vi.mocked<BlobClient>({
    exists: vi.fn(),
    downloadToBuffer: vi.fn()
} as unknown as BlobClient);

const containerClientMock = vi.mocked<ContainerClient>({
    getBlobClient: vi.fn(() => primaryBlobClientMock)
} as unknown as ContainerClient);

const fallbackContainerClientMock = vi.mocked<ContainerClient>({
    getBlobClient: vi.fn(() => fallbackBlobClientMock)
} as unknown as ContainerClient);

const blobServiceClientMock = vi.mocked<BlobServiceClient>({
    getContainerClient: vi.fn(() => containerClientMock)
} as unknown as BlobServiceClient);

const fallbackBlobServiceClientMock = vi.mocked<BlobServiceClient>({
    getContainerClient: vi.fn(() => fallbackContainerClientMock)
} as unknown as BlobServiceClient);

const containerName = "primary" as NonEmptyString;
const fallbackContainerName = "fallback" as NonEmptyString;
const blobName = "blob" as any;


describe("getBlobAsText", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const get = getBlobAsText(
        blobServiceClientMock,
        containerName,
        fallbackBlobServiceClientMock,
        fallbackContainerName
    );

    it("builds the BlobClientWithFallback using the migration kit", async () => {
        const buildBlobClientWithFallbackSpy = vi
            .spyOn(migrationKit, "buildBlobClientWithFallback")

        await get(blobName)();

        expect(
            buildBlobClientWithFallbackSpy
        ).toHaveBeenCalledExactlyOnceWith(
            blobServiceClientMock,
            containerName,
            fallbackBlobServiceClientMock,
            fallbackContainerName,
            blobName
        );
    });

    it("returns Some(text) when the blob exists and downloads successfully", async () => {
        const text = "hello world";

        primaryBlobClientMock.exists.mockResolvedValueOnce(true);
        primaryBlobClientMock.downloadToBuffer.mockResolvedValueOnce(
            Buffer.from(text, "utf-8")
        );

        const result = await get(blobName)();

        expect(primaryBlobClientMock.exists).toHaveBeenCalledOnce();
        expect(primaryBlobClientMock.downloadToBuffer).toHaveBeenCalledOnce();
        expect(fallbackBlobClientMock.downloadToBuffer).not.toHaveBeenCalled();

        expect(E.isRight(result)).toBe(true);
        expect(result).toMatchObject(E.right(O.some(text)));
    });


    it("returns None when the blob does not exist", async () => {
        primaryBlobClientMock.exists.mockResolvedValueOnce(false);
        // Since the primary does not exist, only the fallback will be tried
        fallbackBlobClientMock.downloadToBuffer.mockRejectedValueOnce(
            new Error()
        );
        // Now that the download failed, existence will be checked on both primary and fallback by our function
        primaryBlobClientMock.exists.mockResolvedValueOnce(false);
        fallbackBlobClientMock.exists.mockResolvedValueOnce(false);

        const result = await get(blobName)();

        expect(primaryBlobClientMock.exists).toHaveBeenCalledTimes(2);
        expect(primaryBlobClientMock.downloadToBuffer).not.toHaveBeenCalled();
        expect(fallbackBlobClientMock.downloadToBuffer).toHaveBeenCalled();
        expect(fallbackBlobClientMock.exists).toHaveBeenCalledOnce();

        expect(E.isRight(result)).toBe(true);
        expect(result).toMatchObject(E.right(O.none));
    });


    it("returns InternalError when download fails and blob exists on primary", async () => {
        primaryBlobClientMock.exists.mockResolvedValueOnce(true);
        // We simulate a download error on primary
        primaryBlobClientMock.downloadToBuffer.mockRejectedValueOnce(
            new Error("PRIMARY_SERVER_ERR")
        );

        // Now that the download attempt failed, existence on both will be checked
        primaryBlobClientMock.exists.mockResolvedValueOnce(true);
        // Given that the blob exists on primary, our function should return an error without checking fallback existence

        const result = await get(blobName)();

        expect(primaryBlobClientMock.exists).toHaveBeenCalledTimes(2);
        expect(primaryBlobClientMock.downloadToBuffer).toHaveBeenCalledOnce();
        expect(fallbackBlobClientMock.downloadToBuffer).not.toHaveBeenCalled();
        // Since the blob exists on primary, fallback existence should not be checked
        expect(fallbackBlobClientMock.exists).not.toHaveBeenCalled();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(
            E.left(
                expect.objectContaining({
                    detail: expect.stringContaining("Blob download failed"),
                    message: expect.stringContaining("PRIMARY_SERVER_ERR"),
                    kind: "Internal"
                })
            )
        );
    });

    it("returns InternalError when download fails and blob exists on fallback", async () => {
        primaryBlobClientMock.exists.mockResolvedValueOnce(false);
        fallbackBlobClientMock.downloadToBuffer.mockRejectedValueOnce(
            new Error("FALLBACK_SERVER_ERR")
        );
        // Now that the download failed, existence will be checked
        primaryBlobClientMock.exists.mockResolvedValueOnce(false);
        fallbackBlobClientMock.exists.mockResolvedValueOnce(true);

        const result = await get(blobName)();

        expect(primaryBlobClientMock.exists).toHaveBeenCalledTimes(2);
        // Check that primary download was never attempted (since it does not exist)
        expect(primaryBlobClientMock.downloadToBuffer).not.toHaveBeenCalled();
        // Check that fallback download was attempted once
        expect(fallbackBlobClientMock.downloadToBuffer).toHaveBeenCalledOnce();
        // Check that fallback existence was checked once (after download failure)
        expect(fallbackBlobClientMock.exists).toHaveBeenCalledOnce();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(
            E.left(
                expect.objectContaining({
                    detail: expect.stringContaining("Blob download failed"),
                    message: expect.stringContaining("FALLBACK_SERVER_ERR"),
                    kind: "Internal"
                })
            )
        );
    });

    it("returns InternalError when existence check fails", async () => {
        // The migration kit will be checking the existence of the blob on primary first
        primaryBlobClientMock.exists.mockRejectedValueOnce(new Error("PRIMARY_EXISTS_ERR_1"));
        // Since existence check failed, the migration kit will not attempt download on either primary or fallback
        // Our function will then attempt to check existence again to determine if the blob is missing or if there was an error
        primaryBlobClientMock.exists.mockRejectedValueOnce(new Error("PRIMARY_EXISTS_ERR_2"));

        const result = await get(blobName)();

        // Check that primary existence was checked twice (once by migration kit, once by our function)
        expect(primaryBlobClientMock.exists).toHaveBeenCalledTimes(2);
        // Check that primary download was never attempted (since existence check failed)
        expect(primaryBlobClientMock.downloadToBuffer).not.toHaveBeenCalled();
        expect(fallbackBlobClientMock.downloadToBuffer).not.toHaveBeenCalled();
        // Check that fallback existence was never attempted (since primary existence check failed)
        expect(fallbackBlobClientMock.exists).not.toHaveBeenCalled();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(
            E.left(
                expect.objectContaining({
                    detail: expect.stringContaining("Blob existence check failed"),
                    message: expect.stringContaining("PRIMARY_EXISTS_ERR_2"),
                    kind: "Internal"
                })
            )
        );
    });
});
