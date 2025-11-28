import { BlobServiceClient } from "@azure/storage-blob";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import {
  LolliPOPKeysModel,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";
import { getBlobAsText } from "./blob";
import {
  cosmosErrorsToString,
  toInternalError,
  DomainError,
  ErrorKind,
  toNotFoundError
} from "./errors";

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
  assertionContainerName: NonEmptyString,
  blobServiceFallback: BlobServiceClient,
  assertionContainerNameFallback: NonEmptyString
): AssertionReader => (
  assertionFileName: AssertionFileName
): ReturnType<AssertionReader> =>
  pipe(
    getBlobAsText(
      blobService,
      assertionContainerName,
      blobServiceFallback,
      assertionContainerNameFallback
    )(assertionFileName),
    TE.mapLeft(error =>
      toInternalError(
        `Unable to get assertion blob as text: ${error.message}`,
        `Unable to get assertion blob as text`
      )
    ),
    TE.chainW(TE.fromOption(() => toNotFoundError())),
    TE.filterOrElseW(NonEmptyString.is, () =>
      toInternalError(`Assertion is empty`)
    )
  );
