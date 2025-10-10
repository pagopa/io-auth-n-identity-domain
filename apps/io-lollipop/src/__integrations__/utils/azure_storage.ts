import { BlobService } from "azure-storage";
import { BlobServiceWithFallBack } from "@pagopa/azure-storage-legacy-migration-kit";
import { QueueServiceClient } from "@azure/storage-queue";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";

export const createBlobsOnStorages = (blobServiceClient: BlobServiceWithFallBack, blobs: string[]) =>
  pipe(
    [blobServiceClient.primary, ...(blobServiceClient.secondary ? [blobServiceClient.secondary] : [])],
    RA.map(bs => createBlobs(bs, blobs)),
    RA.sequence(T.ApplicativeSeq),
    T.map(RA.sequence(E.Applicative)),
);

const createBlobs = (blobServiceClient: BlobService, blobs: string[]) =>
  pipe(
    blobs,
    T.of,
    T.chain(
      flow(
        RA.map(b =>
          TE.tryCatch(
            async () =>
              blobServiceClient.createContainerIfNotExists(
                b,
                (error, result) => {
                  if (!error) Promise.resolve(result);
                  else Promise.reject(error);
                }
              ),
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
