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
      error.message === "The specified blob does not exist."
        ? toNotFoundError()
        : toInternalError(
            `Unable to download assertion blob: ${error.message}`,
            `Unable to download assertion blob`
          )
    )
  );

export const getBlobAsText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
): TE.TaskEither<NotFoundError | InternalError, string> =>
  pipe(
    downloadBlob(blobServiceClient, containerName, blobName),
    TE.chainW(streamToText)
  );

export const upsertBlobFromText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  content: string
): TE.TaskEither<InternalError, void> =>
  pipe(
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
    TE.map(_response => undefined), // TODO: check status codes
    TE.mapLeft((error: Error) =>
      toInternalError(
        error.message,
        "Error saving assertion file on blob storage"
      )
    )
  );
