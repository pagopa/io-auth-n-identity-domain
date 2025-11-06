import { BlobServiceClient } from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import {
  InternalError,
  NotFoundError,
  toInternalError,
  toNotFoundError
} from "./errors";

/**
 * Converts a ReadableStream into a string.
 *
 * @param readable - The ReadableStream to convert.
 * @returns A TaskEither that resolves to the string content of the stream,
 *          or an InternalError on failure.
 */
export const streamToText = (
  readable: NodeJS.ReadableStream
): TE.TaskEither<InternalError, string> =>
  pipe(
    TE.tryCatch(async () => {
      readable.setEncoding("utf8");

      // eslint-disable-next-line functional/no-let
      let result = "";
      for await (const chunk of readable as AsyncIterable<string | Buffer>) {
        result += chunk.toString();
      }
      return result;
    }, E.toError),
    TE.mapLeft(error =>
      toInternalError(
        `Unable to download assertion blob: ${error.message}`,
        `Unable to download assertion blob`
      )
    )
  );

/**
 * Checks if a blob exists in the specified Azure Blob Storage container.
 *
 * @param blobServiceClient - The Azure BlobServiceClient instance used to interact with Blob Storage.
 * @param containerName - The name of the container where the blob is stored.
 * @param blobName - The name of the blob to check for existence.
 * @returns A TaskEither that resolves to true if the blob exists, false otherwise,
 *          or an InternalError on failure.
 */
export const blobExists = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
): TE.TaskEither<InternalError, boolean> =>
  pipe(
    TE.tryCatch(
      () =>
        blobServiceClient
          .getContainerClient(containerName)
          .getBlobClient(blobName)
          .exists(),
      E.toError
    ),
    TE.mapLeft(error =>
      toInternalError(error.message, "Error checking assertion file existence")
    )
  );

/**
 * Downloads a blob from the specified Azure Blob Storage container and returns its readable stream.
 *
 * @param blobServiceClient - The Azure BlobServiceClient instance used to interact with Blob Storage.
 * @param containerName - The name of the container where the blob is stored.
 * @param blobName - The name of the blob to be downloaded.
 * @returns A TaskEither that resolves to the blob's readable stream on success,
 *          or a NotFoundError if the blob does not exist, or an InternalError on other failures.
 */
const downloadBlob = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
): TE.TaskEither<NotFoundError | InternalError, NodeJS.ReadableStream> =>
  pipe(
    TE.tryCatch(
      () =>
        blobServiceClient
          .getContainerClient(containerName)
          .getBlobClient(blobName)
          .download(),
      E.toError
    ),
    TE.chainW(response =>
      TE.fromEither(
        pipe(
          response.readableStreamBody,
          O.fromNullable,
          E.fromOption(() => Error("Blob stream is null or undefined"))
        )
      )
    ),
    TE.mapLeft(error =>
      error.message.startsWith("The specified blob does not exist.")
        ? toNotFoundError()
        : toInternalError(
            `Unable to download assertion blob: ${error.message}`,
            `Unable to download assertion blob`
          )
    )
  );

/**
 * Downloads a blob from the specified Azure Blob Storage container and returns its content as text.
 *
 * @param blobServiceClient - The Azure BlobServiceClient instance used to interact with Blob Storage.
 * @param containerName - The name of the container where the blob is stored.
 * @param blobName - The name of the blob to be downloaded.
 * @returns A TaskEither that resolves to the blob content as a string on success,
 *          or a NotFoundError if the blob does not exist, or an InternalError on other failures.
 */
export const getBlobAsText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
): TE.TaskEither<NotFoundError | InternalError, string> =>
  pipe(
    downloadBlob(blobServiceClient, containerName, blobName),
    TE.chainW(streamToText)
  );

/**
 * Uploads a text content as a blob to the specified Azure Blob Storage container.
 *
 * @param blobServiceClient - The Azure BlobServiceClient instance used to interact with Blob Storage.
 * @param containerName - The name of the container where the blob will be uploaded.
 * @param blobName - The name to assign to the uploaded blob.
 * @param content - The string content to be uploaded as the blob.
 * @returns A TaskEither that resolves to void on success, or an InternalError on failure.
 */
export const uploadBlobFromText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  content: string
): TE.TaskEither<InternalError, void> =>
  pipe(
    // Try to upload the blob
    TE.tryCatch(
      () =>
        blobServiceClient
          .getContainerClient(containerName)
          .getBlockBlobClient(blobName)
          .uploadData(Buffer.from(content), {
            blobHTTPHeaders: { blobContentType: "text/plain" }
          }),
      E.toError
    ),
    // If successful, map to void
    // TODO: check if status code should be checked
    TE.map(_response => undefined),
    // Map any error to InternalError
    TE.mapLeft((error: Error) =>
      toInternalError(
        error.message,
        "Error saving assertion file on blob storage"
      )
    )
  );
