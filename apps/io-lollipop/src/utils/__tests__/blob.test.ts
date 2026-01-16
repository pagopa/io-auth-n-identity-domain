import { Readable } from 'stream';
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import { getBlobAsText } from "../blob";
import { buildBlobClientWithFallback } from "../blob_client";
import { BlobClientWithFallback } from "@pagopa/azure-storage-migration-kit";
import { RestError } from "@azure/storage-blob";


const downloadMock = vi.fn();

const blobClientWithFallbackMock = () => ({
    download: downloadMock
}) as unknown as BlobClientWithFallback;

vi.mock("../blob_client", () => ({
    buildBlobClientWithFallback: vi.fn(() => blobClientWithFallbackMock)
}));


describe("getBlobAsText", () => {
    const blobService = {} as any;
    const blobServiceFallback = {} as any;
    const container = "c" as any;
    const containerFallback = "cf" as any;
    const blobName = "file.txt" as any;

    beforeEach(() => vi.clearAllMocks());

    it("should return O.some", async () => {
        downloadMock.mockResolvedValue({
            readableStreamBody: Readable.from(["hello"])
        });
        const tracker = () => { return void 0; };

        const reader = getBlobAsText(
            blobService,
            container,
            blobServiceFallback,
            containerFallback,
            tracker
        );

        const result = await reader(blobName)();

        expect(buildBlobClientWithFallback).toHaveBeenCalledWith(
            { containerName: container, service: blobService },
            { containerName: containerFallback, service: blobServiceFallback },
            tracker
        );

        expect(result).toEqual(E.right(O.some("hello")));
    });

    it("should return O.none on RestError 404", async () => {
        downloadMock.mockRejectedValue(new RestError("Blob not found", { statusCode: 404 }));

        const reader = getBlobAsText(
            blobService,
            container,
            blobServiceFallback,
            containerFallback
        );

        const result = await reader(blobName)();

        expect(result).toEqual(E.right(O.none));
    });

    it("should return left on a RestError different from 404", async () => {
        const unauthorizedError = new RestError("Unauthorized", { statusCode: 401 });
        downloadMock.mockRejectedValue(unauthorizedError);

        const reader = getBlobAsText(
            blobService,
            container,
            blobServiceFallback,
            containerFallback
        );

        const result = await reader(blobName)();

        expect(result).toEqual(E.left(unauthorizedError));
    });

    it("should return left on generic error", async () => {
        const genericError = new Error("Something went wrong");
        downloadMock.mockRejectedValue(genericError);

        const reader = getBlobAsText(
            blobService,
            container,
            blobServiceFallback,
            containerFallback
        );

        const result = await reader(blobName)();

        expect(result).toEqual(E.left(genericError));
    });
});
