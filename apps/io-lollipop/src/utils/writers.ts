import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { upsertBlobFromText } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { BlobService } from "azure-storage";
import { BlobServiceClient } from "@azure/storage-blob";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  LolliPOPKeysModel,
  NewLolliPopPubKeys,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";
import { cosmosErrorsToString, InternalError, toInternalError } from "./errors";

export type PopDocumentWriter = (
  item: NewLolliPopPubKeys
) => TE.TaskEither<InternalError, RetrievedLolliPopPubKeys>;

export type AssertionWriter = (
  assertionFileName: AssertionFileName,
  assertion: string
) => TE.TaskEither<InternalError, true>;

// IMPLEMENTATION
export const getPopDocumentWriter = (
  lollipopKeysModel: LolliPOPKeysModel
): PopDocumentWriter => (item): ReturnType<PopDocumentWriter> =>
  pipe(
    lollipopKeysModel.upsert(item),
    TE.mapLeft(error =>
      toInternalError(
        cosmosErrorsToString(error),
        "Error creating pubKey document"
      )
    )
  );

export const getAssertionWriter = (
  assertionBlobService: BlobServiceClient,
  lollipopAssertionStorageContainerName: NonEmptyString
): AssertionWriter => (
  assertionFileName,
  assertion
): ReturnType<AssertionWriter> =>
  pipe(
    TE.tryCatch(
      () =>
        assertionBlobService
          .getContainerClient(lollipopAssertionStorageContainerName)
          .getBlobClient(assertionFileName)
          .exists(),
      E.toError
    ),
    TE.mapLeft(error =>
      toInternalError(error.message, "Error checking assertion file existance")
    ),
    TE.filterOrElse(
      fileEsists => !fileEsists,
      () => toInternalError("Assertion already exists")
    ),
    TE.chainW(() =>
      pipe(
        TE.tryCatch(
          () =>
            assertionBlobService
              .getContainerClient(lollipopAssertionStorageContainerName)
              .getBlockBlobClient(assertionFileName)
              .uploadData(Buffer.from(assertion), {
                blobHTTPHeaders: { blobContentType: "text/plain" }
              }),
          E.toError
        ),
        TE.mapLeft((error: Error) =>
          toInternalError(
            error.message,
            "Error saving assertion file on blob storage"
          )
        )
      )
    ),
    TE.map(_ => true)
  );
