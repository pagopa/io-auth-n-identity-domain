import {
  BlobClient,
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient
} from "@azure/storage-blob";
import {
  BlobClientWithFallback,
  BlockBlobClientWithFallback,
  FallbackTracker,
  StorageBlobClientWithFallback
} from "@pagopa/azure-storage-migration-kit";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

/**
 * Represents a blob's location in Azure Storage.
 * Combines a service client and a container name.
 */
export interface IBlobLocation {
  readonly service: BlobServiceClient;
  readonly containerName: NonEmptyString;
}

/**
 * Generic curried builder for StorageBlobClientWithFallback subclasses.
 *
 * This function returns a **factory function** that, given primary and fallback blob locations
 * and an optional FallbackTracker, produces another function that takes the blob name
 * and constructs the concrete fallback client (`BlobClientWithFallback` or `BlockBlobClientWithFallback`).
 *
 * @template T - Type of underlying blob client (`BlobClient` or `BlockBlobClient`)
 * @template C - Type of fallback client (`StorageBlobClientWithFallback<T>`)
 *
 * @param ClientClass - The concrete fallback client class to instantiate
 * @param getClient - Function to obtain a blob client from a container and blob name
 *
 * @returns A curried function:
 *   1. `(primary: IBlobLocation, fallback: IBlobLocation, tracker?: FallbackTracker)`
 *   2. `(blobName: NonEmptyString) => C`
 *
 * @example
 * ```ts
 * const buildBlobClient = buildClientWithFallback(
 *   BlobClientWithFallback,
 *   (container, name) => container.getBlobClient(name)
 * );
 *
 * const blobClient = buildBlobClient(primaryLocation, fallbackLocation)("myBlob.txt");
 * ```
 */
export const buildClientWithFallback = <
  T extends BlobClient | BlockBlobClient,
  C extends StorageBlobClientWithFallback<T>
>(
  ClientClass: new (primary: T, fallback?: T, tracker?: FallbackTracker) => C,
  getClient: (container: ContainerClient, name: string) => T
) => (
  primary: IBlobLocation,
  fallback: IBlobLocation,
  tracker?: FallbackTracker
) => (blobName: NonEmptyString): C =>
  new ClientClass(
    getClient(
      primary.service.getContainerClient(primary.containerName),
      blobName
    ),
    getClient(
      fallback.service.getContainerClient(fallback.containerName),
      blobName
    ),
    tracker
  );

/**
 * Convenience builder for `BlobClientWithFallback`.
 *
 * Example usage:
 * ```ts
 * const blobClient = buildBlobClientWithFallback(primaryLocation, fallbackLocation)("file.txt");
 * ```
 */
export const buildBlobClientWithFallback = buildClientWithFallback(
  BlobClientWithFallback,
  (container, name) => container.getBlobClient(name)
);

/**
 * Convenience builder for `BlockBlobClientWithFallback`.
 *
 * Example usage:
 * ```ts
 * const blockBlobClient = buildBlockBlobClientWithFallback(primaryLocation, fallbackLocation)("file.txt");
 * ```
 */
export const buildBlockBlobClientWithFallback = buildClientWithFallback(
  BlockBlobClientWithFallback,
  (container, name) => container.getBlockBlobClient(name)
);
