import { BlobServiceClient } from "@azure/storage-blob";
import { QueueServiceClient } from "@azure/storage-queue";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";

export const createBlobs = (blobServiceClient: BlobServiceClient, blobs: string[]) =>
  pipe(
    blobs,
    T.of,
    T.chain(
      flow(
        RA.map(b =>
          TE.tryCatch(
            () => blobServiceClient.getContainerClient(b).createIfNotExists(),
            E.toError
          )
        ),
        RA.sequence(TE.ApplicativeSeq)
      )
    )
  );

export const createQueues = (
  queueServiceClient: QueueServiceClient,
  queues: string[]
) =>
  pipe(
    queues,
    T.of,
    T.chain(
      flow(
        RA.map(q =>
          TE.tryCatch(async () => queueServiceClient.createQueue(q), E.toError)
        ),
        RA.sequence(T.ApplicativeSeq)
      )
    )
  );

export const deleteBlob = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
) =>
  pipe(
    TE.tryCatch(
      () => blobServiceClient.getContainerClient(containerName).getBlobClient(blobName).delete(),
      E.toError
    )
  );
