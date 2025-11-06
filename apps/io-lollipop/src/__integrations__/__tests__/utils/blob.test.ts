import { beforeAll, describe, it, expect } from "vitest";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import { BlobServiceClient } from "@azure/storage-blob";
import {
    blobExists,
    getBlobAsText,
    streamToText,
    uploadBlobFromText
} from "../../../utils/blob";
import { QueueStorageConnection } from "../../env";


const blobServiceClient = BlobServiceClient.fromConnectionString(QueueStorageConnection);
const containerName = "test-container";
const blobName = "example.txt";
const blobContent = "Hello from Azurite!";

beforeAll(async () => {
    const container = blobServiceClient.getContainerClient(containerName);
    await container.createIfNotExists();
});

describe("blobUtils integration", () => {
    it("should upload and read a blob successfully", async () => {
        // Upload blob
        const uploadResult = await uploadBlobFromText(
            blobServiceClient,
            containerName,
            blobName,
            blobContent
        )();
        expect(E.isRight(uploadResult)).toBe(true);
        expect(uploadResult).toMatchObject(E.right(void 0));

        // Check existence
        const existsResult = await blobExists(
            blobServiceClient,
            containerName,
            blobName
        )();

        expect(E.isRight(existsResult)).toBe(true);
        expect(existsResult).toMatchObject(E.right(true));

        // Download blob content
        const downloadResult = await getBlobAsText(
            blobServiceClient,
            containerName,
            blobName
        )();

        expect(E.isRight(downloadResult)).toBe(true);
        expect(downloadResult).toMatchObject(E.right(blobContent));
    });

    it("should return NotFoundError when blob does not exist", async () => {
        // Attempt to download a non-existing blob
        const result = await getBlobAsText(
            blobServiceClient,
            containerName,
            "missing-blob.txt"
        )();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(E.left({ kind: "NotFound" }));
    });

    it("should convert a stream to text", async () => {
        const container = blobServiceClient.getContainerClient(containerName);
        const blobClient = container.getBlockBlobClient(blobName);
        const response = await blobClient.download();

        const streamResult = await streamToText(response.readableStreamBody!)();

        expect(E.isRight(streamResult)).toBe(true);
        expect(streamResult).toMatchObject(E.right(blobContent));
    });

    it("should handle upload error when using invalid container", async () => {
        const result = await uploadBlobFromText(
            blobServiceClient,
            "nonexistent-container",
            "blob.txt",
            "test content"
        )();

        expect(E.isLeft(result)).toBe(true);
        expect(result).toMatchObject(E.left({
            kind: "Internal", message: expect.stringContaining("The specified container does not exist.")}));
    });
});
