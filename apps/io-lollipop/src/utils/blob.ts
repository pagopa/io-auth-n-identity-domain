import { BlobServiceClient } from "@azure/storage-blob";
import { BlobUtil } from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import {
  InternalError,
  NotFoundError,
  toInternalError,
  toNotFoundError
} from "./errors";

export const blobExists = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
): TE.TaskEither<InternalError, boolean> =>
  pipe(
    BlobUtil.blobExists(blobServiceClient, containerName, blobName),
    TE.mapLeft(error =>
      toInternalError(error.message, "Error checking assertion file existence")
    )
  );

export const getBlobAsText = (
  blobServiceClient: BlobServiceClient,
  containerName: string
) => (blobName: string): TE.TaskEither<NotFoundError | InternalError, string> =>
  pipe(
    BlobUtil.getBlobAsText(blobServiceClient, containerName)(blobName),
    TE.mapLeft(error =>
      error.message.startsWith("The specified blob does not exist.")
        ? toNotFoundError()
        : toInternalError(
            `Unable to get assertion blob as text: ${error.message}`,
            `Unable to get assertion blob as text`
          )
    )
  );

export const upsertBlobFromText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  content: string
): TE.TaskEither<InternalError, void> =>
  pipe(
    BlobUtil.upsertBlobFromText(
      blobServiceClient,
      containerName,
      blobName,
      content
    ),
    // Map any error to InternalError
    TE.mapLeft((error: Error) =>
      toInternalError(
        error.message,
        "Error saving assertion file on blob storage"
      )
    )
  );
