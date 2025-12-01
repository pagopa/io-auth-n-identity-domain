import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlobServiceClient } from "@azure/storage-blob";
import { BlobClientWithFallback } from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import * as migrationKit from "../migration_kit";
import { getBlobAsText } from "../blob";


const blobClientWithFallback = vi.mocked<BlobClientWithFallback>({
    downloadToBuffer: vi.fn(async () => Buffer.from("blob content")),
    exists: vi.fn(async () => true)
} as unknown as BlobClientWithFallback);

const buildBlobClientWithFallbackSpy = vi
    .spyOn(migrationKit, "buildBlobClientWithFallback")
    .mockImplementation(() =>
        TE.right(blobClientWithFallback)
    );

const BLOB_NAME = "blob" as AssertionFileName;

const PRIMARY_CONTAINER_NAME = "primary" as NonEmptyString;
const PRIMARY_BLOB_SERVICE_CLIENT = vi.mocked<BlobServiceClient>(
    {} as unknown as BlobServiceClient);

const FALLBACK_CONTAINER_NAME = "fallback" as NonEmptyString;
const FALLBACK_BLOB_SERVICE_CLIENT = vi.mocked<BlobServiceClient>(
    {} as unknown as BlobServiceClient
);

describe("getBlobAsText", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("builds the BlobClientWithFallback using the migration kit", async () => {
        await getBlobAsText(
            PRIMARY_BLOB_SERVICE_CLIENT,
            PRIMARY_CONTAINER_NAME,
            FALLBACK_BLOB_SERVICE_CLIENT,
            FALLBACK_CONTAINER_NAME
        )(BLOB_NAME)();

        expect(buildBlobClientWithFallbackSpy).toHaveBeenCalledExactlyOnceWith(
            vi.mocked<BlobServiceClient>({} as any),
            "primary" as any,
            vi.mocked<BlobServiceClient>({} as any),
            "fallback" as any,
            BLOB_NAME
        );
    });

    it("returns the blob content as text", async () => {
        const result = await getBlobAsText(
            PRIMARY_BLOB_SERVICE_CLIENT,
            PRIMARY_CONTAINER_NAME,
            FALLBACK_BLOB_SERVICE_CLIENT,
            FALLBACK_CONTAINER_NAME
        )(BLOB_NAME)();

        expect(blobClientWithFallback.downloadToBuffer).toHaveBeenCalledOnce();
        expect(blobClientWithFallback.exists).not.toHaveBeenCalled();

        expect(result).toMatchObject(E.right(O.some("blob content")));
    });

    it("returns None if the blob does not exist", async () => {
        blobClientWithFallback.downloadToBuffer.mockImplementationOnce(async () => {
            throw new Error("Blob not found");
        });
        blobClientWithFallback.exists.mockImplementationOnce(async () => false);

        const result = await getBlobAsText(
            PRIMARY_BLOB_SERVICE_CLIENT,
            PRIMARY_CONTAINER_NAME,
            FALLBACK_BLOB_SERVICE_CLIENT,
            FALLBACK_CONTAINER_NAME
        )(BLOB_NAME)();

        expect(blobClientWithFallback.downloadToBuffer).toHaveBeenCalledOnce();
        expect(blobClientWithFallback.exists).toHaveBeenCalledOnce();

        expect(result).toMatchObject(E.right(O.none));
    });

    it("returns an error if the blob download fails for reasons other than not found", async () => {
        blobClientWithFallback.downloadToBuffer.mockImplementationOnce(async () => {
            throw new Error("Network error");
        });
        blobClientWithFallback.exists.mockImplementationOnce(async () => true);

        const result = await getBlobAsText(
            PRIMARY_BLOB_SERVICE_CLIENT,
            PRIMARY_CONTAINER_NAME,
            FALLBACK_BLOB_SERVICE_CLIENT,
            FALLBACK_CONTAINER_NAME
        )(BLOB_NAME)();

        expect(blobClientWithFallback.downloadToBuffer).toHaveBeenCalledOnce();
        expect(blobClientWithFallback.exists).toHaveBeenCalledOnce();

        expect(result).toMatchObject(E.left({
            message: expect.stringContaining("Network error"),
            kind: "Internal",
            detail: expect.stringContaining("Blob download failed")
        }));
    });

    it("returns an error if checking blob existence fails", async () => {
        blobClientWithFallback.downloadToBuffer.mockImplementationOnce(async () => {
            throw new Error("Something went wrong");
        });
        blobClientWithFallback.exists.mockImplementationOnce(async () => {
            throw new Error("Existence check failed");
        });

        const result = await getBlobAsText(
            PRIMARY_BLOB_SERVICE_CLIENT,
            PRIMARY_CONTAINER_NAME,
            FALLBACK_BLOB_SERVICE_CLIENT,
            FALLBACK_CONTAINER_NAME
        )(BLOB_NAME)();

        expect(blobClientWithFallback.downloadToBuffer).toHaveBeenCalledOnce();
        expect(blobClientWithFallback.exists).toHaveBeenCalledOnce();

        expect(result).toMatchObject(E.left({
            message: expect.stringContaining("Existence check failed"),
            kind: "Internal",
            detail: expect.stringContaining("Blob existence check failed")
        }));
    });

});