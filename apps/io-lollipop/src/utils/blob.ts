import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import {
  BlobClient,
  BlobServiceClient,
  BlockBlobClient
} from "@azure/storage-blob";
import {
  FallbackTracker,
  StorageBlobClientWithFallback
} from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  isRestError,
  streamToText
} from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
import { pipe } from "fp-ts/lib/function";
import { buildBlobClientWithFallback } from "./blob_client";

const getBlobToBufferAsText = (
  storageBlobClientWithFallback: StorageBlobClientWithFallback<
    BlobClient | BlockBlobClient
  >
): TE.TaskEither<Error, string> =>
  pipe(
    TE.tryCatch(() => storageBlobClientWithFallback.download(), E.toError),
    TE.chain(response =>
      response.readableStreamBody
        ? streamToText(response.readableStreamBody)
        : TE.left(new Error("Blob stream is null or undefined"))
    )
  );

const getBlobToBufferAsTextIfExistsOrNone = (
  blobClient: StorageBlobClientWithFallback<BlobClient | BlockBlobClient>
): TE.TaskEither<Error, O.Option<string>> =>
  pipe(
    getBlobToBufferAsText(blobClient),
    TE.map(text => O.some(text)),
    TE.orElse(err =>
      isRestError(err) && err.statusCode === 404
        ? TE.right(O.none)
        : TE.left(err)
    )
  );

export const getBlobAsText = (
  blobServiceClient: BlobServiceClient,
  containerName: NonEmptyString,
  blobServiceClientFallback: BlobServiceClient,
  containerNameFallback: NonEmptyString,
  tracker?: FallbackTracker
) => (blobName: NonEmptyString): TE.TaskEither<Error, O.Option<string>> =>
  pipe(
    buildBlobClientWithFallback(
      {
        containerName,
        service: blobServiceClient
      },
      {
        containerName: containerNameFallback,
        service: blobServiceClientFallback
      },
      tracker
    )(blobName),
    getBlobToBufferAsTextIfExistsOrNone
  );
