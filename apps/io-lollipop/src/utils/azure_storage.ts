import { BlobServiceClient } from "@azure/storage-blob";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

export const streamToText = (
  readable: NodeJS.ReadableStream
): TE.TaskEither<Error, string> =>
  TE.tryCatch(
    async () => {
      readable.setEncoding("utf8");

      // eslint-disable-next-line functional/no-let
      let result = "";
      for await (const chunk of readable as AsyncIterable<string | Buffer>) {
        result += chunk.toString();
      }
      return result;
    },
    reason => (reason instanceof Error ? reason : new Error(String(reason)))
  );

export const getBlobToText = (
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string
): TE.TaskEither<Error, string> =>
  pipe(
    TE.tryCatch(
      () =>
        blobServiceClient
          .getContainerClient(containerName)
          .getBlobClient(blobName)
          .download(),
      E.toError
    ),
    TE.chainW(response => streamToText(response.readableStreamBody!))
  );