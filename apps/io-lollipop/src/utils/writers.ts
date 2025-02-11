import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { upsertBlobFromText } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { BlobService } from "azure-storage";
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
  assertionBlobService: BlobService,
  lollipopAssertionStorageContainerName: NonEmptyString
): AssertionWriter => (
  assertionFileName,
  assertion
): ReturnType<AssertionWriter> =>
  pipe(
    TE.taskify<Error, BlobService.BlobResult>(cb =>
      assertionBlobService.doesBlobExist(
        lollipopAssertionStorageContainerName,
        assertionFileName,
        cb
      )
    )(),
    TE.mapLeft(error =>
      toInternalError(error.message, "Error checking assertion file existance")
    ),
    TE.map(blobResult => blobResult.exists ?? false),
    TE.filterOrElse(
      fileEsists => !fileEsists,
      () => toInternalError(`Assertion already exists`)
    ),
    TE.chainW(() =>
      pipe(
        TE.tryCatch(
          () =>
            upsertBlobFromText(
              assertionBlobService,
              lollipopAssertionStorageContainerName,
              assertionFileName,
              assertion
            ),
          E.toError
        ),
        TE.chainW(TE.fromEither),
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
