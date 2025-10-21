import {
  BlobDownloadResponseParsed,
  BlobServiceClient
} from "@azure/storage-blob";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { flow, identity, pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { getBlobAsText } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";

import { Context } from "@azure/functions";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import {
  LolliPOPKeysModel,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";
import {
  cosmosErrorsToString,
  toInternalError,
  toNotFoundError,
  DomainError,
  ErrorKind
} from "./errors";
import { streamToText } from "./azure_storage";

export type PublicKeyDocumentReader = RTE.ReaderTaskEither<
  AssertionRef,
  DomainError,
  RetrievedLolliPopPubKeys
>;

export type AssertionReader = RTE.ReaderTaskEither<
  AssertionFileName,
  DomainError,
  NonEmptyString
>;

// -------------------------
// Readers implementations
// -------------------------

/**
 * Return a PublicKeyDocumentReader that retrieves the value from Cosmos
 *
 * @param lollipopKeysModel the LolliPOPKeysModel model to use
 * @returns The PublicKeyDocumentReader
 */
export const getPublicKeyDocumentReader = (
  lollipopKeysModel: LolliPOPKeysModel
): PublicKeyDocumentReader => (
  assertionRef: AssertionRef
): ReturnType<PublicKeyDocumentReader> =>
  pipe(
    lollipopKeysModel.findLastVersionByModelId([assertionRef]),
    TE.mapLeft(error =>
      toInternalError(
        cosmosErrorsToString(error),
        "Error retrieving pubKey document"
      )
    ),
    TE.chainW(TE.fromOption(() => ({ kind: ErrorKind.NotFound as const })))
  );

/**
 * Return a AssertionReader that retrieves the value from a Blob Service
 *
 * @param blobService the azure blobService
 * @param assertionContainerName the name of the container where the blob is stored
 * @returns The AssertionReader
 */
export const getAssertionReader = (
  blobService: BlobServiceClient,
  assertionContainerName: NonEmptyString
): AssertionReader => (
  assertionFileName: AssertionFileName
): ReturnType<AssertionReader> =>
  pipe(
    TE.tryCatch(
      () =>
        blobService
          .getContainerClient(assertionContainerName)
          .getBlobClient(assertionFileName)
          .download(),
      E.toError
    ),
    TE.mapLeft(error =>
      error.message === "The specified blob does not exist."
        ? toNotFoundError()
        : toInternalError(
            `Unable to download assertion blob: ${error.message}`,
            `Unable to download assertion blob`
          )
    ),
    TE.chainW(r =>
      pipe(
        r.readableStreamBody,
        O.fromNullable,
        TE.fromOption(() => toInternalError("Assertion is empty")),
        TE.map(streamToText),
        TE.mapLeft(error =>
          toInternalError(
            `Unable to read assertion stream: ${error.message}`,
            `Unable to read assertion stream`
          )
        )
      )
    ),
    TE.filterOrElseW(NonEmptyString.is, () =>
      toInternalError(`Assertion is empty`)
    )
  );
