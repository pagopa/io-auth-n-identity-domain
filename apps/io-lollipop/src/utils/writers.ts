import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { BlobServiceClient } from "@azure/storage-blob";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  blobExists,
  upsertBlobFromText
} from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
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
    blobExists(
      assertionBlobService,
      lollipopAssertionStorageContainerName,
      assertionFileName
    ),
    TE.mapLeft(error =>
      toInternalError(error.message, "Error checking assertion file existence")
    ),
    TE.filterOrElse(
      fileExists => !fileExists,
      () => toInternalError("Assertion already exists")
    ),
    TE.chainW(() =>
      pipe(
        upsertBlobFromText(
          assertionBlobService,
          lollipopAssertionStorageContainerName,
          assertionFileName,
          assertion
        ),
        TE.mapLeft(error =>
          toInternalError(
            error.message,
            "Error saving assertion file on blob storage"
          )
        )
      )
    ),
    TE.map(_ => true)
  );
