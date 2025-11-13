import { beforeAll, describe, it, expect } from "vitest";
import * as E from "fp-ts/Either";
import { BlobServiceClient } from "@azure/storage-blob";
import {
  blobExists,
  getBlobAsText,
  streamToText,
  upsertBlobFromText
} from "../../../utils/blob";
import { QueueStorageConnection } from "../../env";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  QueueStorageConnection
);
const containerName = "test-container";
const blobName = "example.txt";
const blobContent = "Blob content for testing.";

beforeAll(async () => {
  const container = blobServiceClient.getContainerClient(containerName);
  await container.createIfNotExists();
});

describe("blobUtils integration", () => {
  it("should upload and read a blob successfully", async () => {
    // Upload blob
    const uploadResult = await upsertBlobFromText(
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
      containerName
    )(blobName)();

    expect(E.isRight(downloadResult)).toBe(true);
    expect(downloadResult).toMatchObject(E.right(blobContent));
  });

  it("should return NotFoundError when blob does not exist", async () => {
    // Attempt to download a non-existing blob
    const result = await getBlobAsText(
      blobServiceClient,
      containerName
    )("missing-blob.txt")();

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
    const result = await upsertBlobFromText(
      blobServiceClient,
      "nonexistent-container",
      "blob.txt",
      "test content"
    )();

    expect(E.isLeft(result)).toBe(true);
    expect(result).toMatchObject(
      E.left({
        kind: "Internal",
        message: expect.stringContaining(
          "The specified container does not exist."
        )
      })
    );
  });

  it("should replace the content when upserting on an already existing blob", async () => {
    // First upload
    const firstUpload = await upsertBlobFromText(
      blobServiceClient,
      containerName,
      blobName,
      "First content"
    )();
    expect(E.isRight(firstUpload)).toBe(true);

    // Second upload to the same blob
    const secondUpload = await upsertBlobFromText(
      blobServiceClient,
      containerName,
      blobName,
      "Second content"
    )();
    expect(E.isRight(secondUpload)).toBe(true);

    // Download to verify content
    const downloadResult = await getBlobAsText(
      blobServiceClient,
      containerName
    )(blobName)();

    expect(E.isRight(downloadResult)).toBe(true);
    expect(downloadResult).toMatchObject(E.right("Second content"));
  });
});
