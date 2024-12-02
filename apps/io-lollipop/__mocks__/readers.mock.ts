import * as TE from "fp-ts/TaskEither";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";

import { AssertionRef } from "../generated/definitions/internal/AssertionRef";

import { AssertionReader, PublicKeyDocumentReader } from "../utils/readers";

import { aRetrievedPendingLollipopPubKeySha256 } from "./lollipopPubKey.mock";

export const anAssertionContent = "an Assertion";

export const publicKeyDocumentReaderMock = jest.fn(
  (assertionRef: AssertionRef) =>
    TE.of({
      ...aRetrievedPendingLollipopPubKeySha256,
      assertionRef: assertionRef,
      id: `${assertionRef}-000000`,
      version: 0
    }) as ReturnType<PublicKeyDocumentReader>
);

export const assertionReaderMock = jest.fn(
  (_: AssertionFileName) =>
    TE.of(anAssertionContent) as ReturnType<AssertionReader>
);
