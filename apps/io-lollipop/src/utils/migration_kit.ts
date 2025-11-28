import {
  BlobClient,
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient
} from "@azure/storage-blob";
import {
  BlobClientWithFallback,
  BlockBlobClientWithFallback,
  StorageBlobClientWithFallback
} from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";
import { InternalError, toInternalError } from "./errors";

/**
 * Generic builder for any StorageBlobClientWithFallback subclass
 *
 * @template T - the type of the underlying blob client (BlobClient or BlockBlobClient)
 * @template C - the StorageBlobClientWithFallback subclass
 */
const buildClientWithFallback = <
  T extends BlobClient | BlockBlobClient,
  C extends StorageBlobClientWithFallback<T>
>(
  blobServiceClient: BlobServiceClient,
  containerName: NonEmptyString,
  blobServiceClientFallback: BlobServiceClient,
  containerNameFallback: NonEmptyString,
  blobName: AssertionFileName,
  ClientClass: new (primary: T, fallback?: T) => C,
  getClient: (container: ContainerClient, name: string) => T
  // eslint-disable-next-line max-params
): TE.TaskEither<InternalError, C> =>
  pipe(
    NonEmptyString.decode(blobName),
    TE.fromEither,
    TE.mapLeft(() =>
      toInternalError(
        `Cannot build ${ClientClass.name}: invalid blob name ${blobName}`,
        `Cannot build ${ClientClass.name}`
      )
    ),
    TE.map(
      decodedBlobName =>
        new ClientClass(
          getClient(
            blobServiceClient.getContainerClient(containerName),
            decodedBlobName
          ),
          getClient(
            blobServiceClientFallback.getContainerClient(containerNameFallback),
            decodedBlobName
          )
        )
    )
  );

export const buildBlobClientWithFallback = (
  blobServiceClient: BlobServiceClient,
  containerName: NonEmptyString,
  blobServiceClientFallback: BlobServiceClient,
  containerNameFallback: NonEmptyString,
  blobName: AssertionFileName
): TE.TaskEither<InternalError, BlobClientWithFallback> =>
  buildClientWithFallback(
    blobServiceClient,
    containerName,
    blobServiceClientFallback,
    containerNameFallback,
    blobName,
    BlobClientWithFallback,
    (container, name) => container.getBlobClient(name)
  );

export const buildBlockBlobClientWithFallback = (
  blobServiceClient: BlobServiceClient,
  containerName: NonEmptyString,
  blobServiceClientFallback: BlobServiceClient,
  containerNameFallback: NonEmptyString,
  blobName: AssertionFileName
): TE.TaskEither<InternalError, BlockBlobClientWithFallback> =>
  buildClientWithFallback(
    blobServiceClient,
    containerName,
    blobServiceClientFallback,
    containerNameFallback,
    blobName,
    BlockBlobClientWithFallback,
    (container, name) => container.getBlockBlobClient(name)
  );
