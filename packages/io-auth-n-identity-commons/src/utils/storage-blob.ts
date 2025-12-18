import {
  BlobServiceClient,
  BlockBlobUploadOptions,
  RestError,
} from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";

export const isRestError: (u: unknown) => u is RestError = (
  u,
): u is RestError =>
  typeof u === "object" &&
  u !== null &&
  u !== undefined &&
  (u as RestError).name === RestError.name;

/**
 * Converts a Node.js Readable stream into a UTF-8 string.
 *
 * This helper consumes the stream chunk-by-chunk using `for await`, respecting
 * backpressure and avoiding large temporary buffers.
 *
 * @param readable - The ReadableStream to consume.
 *
 * @returns A `TaskEither<Error, string>` which:
 *   - resolves with the entire UTF-8 decoded text, or
 *   - rejects with an `Error` if streaming fails (I/O error, aborted stream, etc.).
 */
export const streamToText = (
  readable: NodeJS.ReadableStream,
): TE.TaskEither<Error, string> =>
  pipe(
    TE.tryCatch(async () => {
      readable.setEncoding("utf8");

      // eslint-disable-next-line functional/no-let
      let result = "";
      for await (const chunk of readable) {
        result += chunk.toString();
      }
      return result;
    }, E.toError),
  );

/**
 * Checks whether a blob exists in a given Azure Blob Storage container.
 *
 * @param blobServiceClient - A `BlobServiceClient` used to access the storage account.
 * @param containerName - Name of the container to inspect.
 * @param blobName - Name of the blob to test for existence.
 *
 * @returns A `TaskEither<Error, boolean>` which:
 *   - resolves to `true` if the blob exists,
 *   - resolves to `false` if it does not exist,
 *   - rejects with an `Error` if the existence check fails.
 */
export const blobExists = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
): TE.TaskEither<Error, boolean> =>
  pipe(
    TE.tryCatch(
      () =>
        blobServiceClient
          .getContainerClient(containerName)
          .getBlobClient(blobName)
          .exists(),
      E.toError,
    ),
  );

/**
 * Downloads a blob and returns its content as a Node.js Readable stream.
 *
 * @param blobServiceClient - A `BlobServiceClient` used to access the storage account.
 * @param containerName - Name of the container containing the blob.
 *
 * @returns A function that takes a `blobName` and produces a
 *   `TaskEither<Error, NodeJS.ReadableStream>` which:
 *     - resolves with a readable stream of the blob contents,
 *     - rejects if the blob does not exist,
 *     - rejects if the service returns a response without a stream,
 *     - rejects on network or service errors.
 *
 * @remarks
 * This uses the `download()` API, which returns a streaming response.
 * Streaming is recommended for **large blobs**, because:
 *
 *   - the data is processed incrementally,
 *   - memory consumption is constant and low,
 *   - backpressure is respected automatically,
 *   - you can pipe directly to files, HTTP responses, or parsers.
 */
export const downloadBlob =
  (blobServiceClient: BlobServiceClient, containerName: string) =>
  (blobName: string): TE.TaskEither<Error, O.Option<NodeJS.ReadableStream>> =>
    pipe(
      TE.tryCatch(
        () =>
          blobServiceClient
            .getContainerClient(containerName)
            .getBlobClient(blobName)
            .download(),
        E.toError,
      ),
      TE.chain(({ readableStreamBody }) =>
        // Extract the readable stream from the response.
        // This should always be defined for successful downloads,
        // but we guard against null/undefined just in case.
        TE.fromNullable(Error("Blob stream is null or undefined"))(
          readableStreamBody,
        ),
      ),
      TE.map((stream) => O.some(stream)),
      TE.orElse((error) =>
        isRestError(error) && error.statusCode === 404
          ? TE.right(O.none)
          : TE.left(error),
      ),
    );

/**
 * Streams a blob from Azure Blob Storage and returns its content as UTF-8 text.
 *
 * @param blobServiceClient - A `BlobServiceClient` used to access the storage account.
 * @param containerName - Name of the container containing the blob.
 *
 * @returns A function that takes a `blobName` and produces a
 *   `TaskEither<Error, string>` which:
 *     - resolves with the blob’s text content,
 *     - rejects if the blob does not exist,
 *     - rejects on streaming/network/service errors.
 *
 * @remarks
 * This function:
 *   1. downloads the blob via streaming (`download()`),
 *   2. converts the stream incrementally to text using `streamToText`.
 */
export const getBlobAsText =
  (blobServiceClient: BlobServiceClient, containerName: string) =>
  (blobName: string): TE.TaskEither<Error, O.Option<string>> =>
    pipe(
      downloadBlob(blobServiceClient, containerName)(blobName),
      TE.chain(
        // If O.none → return TE.right(O.none)
        // If O.some(stream) → convert to text and wrap back into Some
        O.fold(
          () => TE.right(O.none),
          (stream) => pipe(streamToText(stream), TE.map(O.some)),
        ),
      ),
    );

/**
 * Uploads a UTF-8 string as a blob to Azure Blob Storage, overwriting any
 * existing blob with the same name.
 *
 * @param blobServiceClient - A `BlobServiceClient` used to access the storage account.
 * @param containerName - Name of the container where the blob will be written.
 * @param blobName - Name of the blob to create or overwrite.
 * @param content - The string to upload.
 * @param options - Optional `BlockBlobUploadOptions` to the Block Blob Upload operation.
 *
 * @returns A `TaskEither<Error, void>` which:
 *   - resolves on successful upload,
 *   - rejects on network, authentication, or service errors.
 */
export const upsertBlobFromText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  content: string,
  options?: BlockBlobUploadOptions,
): TE.TaskEither<Error, void> =>
  pipe(
    // Try to upload the blob
    TE.tryCatch(
      () =>
        blobServiceClient
          .getContainerClient(containerName)
          .getBlockBlobClient(blobName)
          .upload(content, content.length, options),
      E.toError,
    ),
    // When successful, map to void
    TE.map((_response) => void 0),
  );

export type BlobUtil = typeof BlobUtil;
export const BlobUtil = {
  streamToText,
  blobExists,
  downloadBlob,
  getBlobAsText,
  upsertBlobFromText,
};
