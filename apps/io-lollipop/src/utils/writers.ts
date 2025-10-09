import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { BlobService } from "azure-storage";
import {
  BlobServiceWithFallBack,
  upsertBlobFromText
} from "@pagopa/azure-storage-legacy-migration-kit";
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

const doesBlobExist = (
  blobService: BlobService,
  container: string,
  blobName: string
): TE.TaskEither<InternalError, boolean> =>
  pipe(
    TE.taskify<Error, BlobService.BlobResult>(cb =>
      blobService.doesBlobExist(container, blobName, cb)
    )(),
    TE.mapLeft(error =>
      toInternalError(error.message, "Error checking assertion file existance")
    ),
    TE.map(result => result.exists ?? false)
  );

export const getAssertionWriter = (
  assertionBlobService: BlobServiceWithFallBack,
  lollipopAssertionStorageContainerName: NonEmptyString
): AssertionWriter => (
  assertionFileName,
  assertion
): ReturnType<AssertionWriter> =>
  pipe(
    doesBlobExist(
      assertionBlobService.primary,
      lollipopAssertionStorageContainerName,
      assertionFileName
    ),
    TE.filterOrElseW(
      exists => !exists,
      () => toInternalError("Assertion already exists")
    ),
    // Check also on secondary
    TE.chainW(() =>
      assertionBlobService.secondary
        ? pipe(
            doesBlobExist(
              assertionBlobService.secondary,
              lollipopAssertionStorageContainerName,
              assertionFileName
            ),
            TE.filterOrElseW(
              exists => !exists,
              () => toInternalError("Assertion already exists")
            )
          )
        : TE.right(false)
    ),
    TE.map(() => true),
    TE.chainW(() =>
      pipe(
        upsertBlobFromText(
          assertionBlobService,
          lollipopAssertionStorageContainerName,
          assertionFileName,
          assertion
        ),
        TE.mapLeft((error: Error) =>
          toInternalError(
            error.message,
            "Error saving assertion file on blob storage"
          )
        ),
        TE.chainW(
          TE.fromOption(() => toInternalError("Can not upload blob to storage"))
        )
      )
    ),
    TE.map(_ => true)
  );
