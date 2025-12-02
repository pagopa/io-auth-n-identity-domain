import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import {
  BlobClient,
  BlobServiceClient,
  BlockBlobClient
} from "@azure/storage-blob";
import { StorageBlobClientWithFallback } from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";
import { InternalError, toInternalError } from "./errors";
import { buildBlobClientWithFallback } from "./migration_kit";

const exists = (
  storageBlobClientWithFallback: StorageBlobClientWithFallback<
    BlobClient | BlockBlobClient
  >
): TE.TaskEither<Error, boolean> =>
  TE.tryCatch(() => storageBlobClientWithFallback.exists(), E.toError);

const getBlobToBufferAsText = (
  storageBlobClientWithFallback: StorageBlobClientWithFallback<
    BlobClient | BlockBlobClient
  >
): TE.TaskEither<Error, string> =>
  pipe(
    TE.tryCatch(
      () => storageBlobClientWithFallback.downloadToBuffer(),
      E.toError
    ),
    TE.map(buffer => buffer.toString("utf-8"))
  );

const getBlobToBufferAsTextIfExistsOrNone = (
  blobClient: StorageBlobClientWithFallback<BlobClient | BlockBlobClient>,
  blobName: AssertionFileName
): TE.TaskEither<InternalError, O.Option<string>> =>
  pipe(
    getBlobToBufferAsText(blobClient),
    TE.map(O.some),
    TE.orElse(downloadError =>
      pipe(
        // Check if the blob exists to distinguish between download errors and not founds
        exists(blobClient),
        TE.mapLeft(existenceCheckError =>
          toInternalError(
            `Error checking existence of blob ${blobName}: ${String(
              existenceCheckError
            )}`,
            "Blob existence check failed"
          )
        ),
        // If the blob exists, return the download error, else return None
        TE.chain(blobExists =>
          blobExists
            ? TE.left(
                toInternalError(
                  `Error downloading blob ${blobName}: ${String(
                    downloadError
                  )}`,
                  "Blob download failed"
                )
              )
            : TE.right(O.none)
        )
      )
    )
  );

export const getBlobAsText = (
  blobServiceClient: BlobServiceClient,
  containerName: NonEmptyString,
  blobServiceClientFallback: BlobServiceClient,
  containerNameFallback: NonEmptyString
) => (
  blobName: AssertionFileName
): TE.TaskEither<InternalError, O.Option<string>> =>
  pipe(
    buildBlobClientWithFallback(
      blobServiceClient,
      containerName,
      blobServiceClientFallback,
      containerNameFallback
    )(blobName),
    TE.chain(blobClient =>
      getBlobToBufferAsTextIfExistsOrNone(blobClient, blobName)
    )
  );
