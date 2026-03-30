import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import { InvocationContext } from "@azure/functions";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { JwkPublicKeyFromToken } from "@pagopa/ts-commons/lib/jwk";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Logger } from "../utils/logging";
import { ActivatedPubKey } from "../generated/definitions/internal/ActivatedPubKey";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { ActivatePubKeyPayload } from "../generated/definitions/internal/ActivatePubKeyPayload";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";

import { RetrievedLolliPopPubKeys } from "../model/lollipop_keys";

import { AssertionWriter, PopDocumentWriter } from "../utils/writers";
import { PublicKeyDocumentReader } from "../utils/readers";
import {
  isPendingLollipopPubKey,
  isValidLollipopPubKey,
  MASTER_HASH_ALGO,
  retrievedLollipopKeysToApiActivatedPubKey,
  getAlgoFromAssertionRef,
  getAllAssertionsRef,
} from "../utils/lollipopKeys";

const FN_LOG_NAME = "activate-pubkey";

export const activatePubKeyForAssertionRef =
  (popDocumentWriter: PopDocumentWriter, eventLogger: Logger) =>
  (
    assertionFileName: AssertionFileName,
    assertionRef: AssertionRef,
    body: ActivatePubKeyPayload,
    pubKey: NonEmptyString,
  ): TE.TaskEither<IResponseErrorInternal, RetrievedLolliPopPubKeys> =>
    pipe(
      popDocumentWriter({
        assertionFileName,
        assertionRef,
        assertionType: body.assertion_type,
        expiredAt: body.expired_at,
        fiscalCode: body.fiscal_code,
        pubKey,
        status: PubKeyStatusEnum.VALID,
      }),
      eventLogger.taskEither.errorLeft((error) => [
        `Error while writing pop document: ${error.kind} - ${error.detail} - ${error.message}`,
        {
          assertion_ref: assertionRef,
          name: FN_LOG_NAME,
        },
      ]),
      TE.mapLeft((error) => ResponseErrorInternal(error.detail)),
    );

// -------------------------------
// Handler
// -------------------------------

type ActivatePubKeyHandler = (
  context: InvocationContext,
  assertion_ref: AssertionRef,
  body: ActivatePubKeyPayload,
) => Promise<
  | IResponseSuccessJson<ActivatedPubKey>
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
>;
export const ActivatePubKeyHandler =
  (
    publicKeyDocumentReader: PublicKeyDocumentReader,
    popDocumentWriter: PopDocumentWriter,
    assertionWriter: AssertionWriter,
    eventLogger: Logger,
  ): ActivatePubKeyHandler =>
  (context, assertion_ref, body): ReturnType<ActivatePubKeyHandler> =>
    pipe(
      publicKeyDocumentReader(assertion_ref),
      eventLogger.taskEither.errorLeft((error) => [
        `Error while reading pop document: ${error.kind}`,
        {
          assertion_ref,
          name: FN_LOG_NAME,
        },
      ]),
      TE.mapLeft((error) =>
        ResponseErrorInternal(
          `Error while reading pop document: ${error.kind}`,
        ),
      ),
      TE.filterOrElseW(
        isPendingLollipopPubKey,
        flow(
          eventLogger.peek.error((doc) => [
            `Unexpected status on pop document during activation: ${doc.status}`,
            {
              assertion_ref,
              name: FN_LOG_NAME,
            },
          ]),
          (_) => ResponseErrorForbiddenNotAuthorized,
        ),
      ),
      TE.bindTo("popDocument"),
      TE.bindW("assertionFileName", () =>
        pipe(
          `${body.fiscal_code}-${assertion_ref}`,
          AssertionFileName.decode,
          TE.fromEither,
          eventLogger.taskEither.errorLeft((_) => [
            // we do not log decoding errors for AssertionFilename
            // because we can leak fiscal code to logs
            `Could not decode assertionFileName`,
            {
              assertion_ref,
              name: FN_LOG_NAME,
            },
          ]),
          TE.mapLeft((_) =>
            ResponseErrorInternal(`Could not decode assertionFileName`),
          ),
          TE.chainFirst((assertionFileName) =>
            pipe(
              assertionWriter(assertionFileName, body.assertion),
              eventLogger.taskEither.errorLeft((error) => [
                `${error.detail}`,
                {
                  assertion_ref,
                  name: FN_LOG_NAME,
                },
              ]),
              TE.mapLeft((error) => ResponseErrorInternal(error.detail)),
            ),
          ),
        ),
      ),
      TE.bindW("jwkPubKeyFromString", ({ popDocument }) =>
        pipe(
          popDocument.pubKey,
          JwkPublicKeyFromToken.decode,
          TE.fromEither,
          TE.mapLeft(
            (errors) =>
              `Could not decode public key | ${readableReportSimplified(errors)}`,
          ),
          eventLogger.taskEither.errorLeft((err) => [
            err,
            {
              assertion_ref,
              name: FN_LOG_NAME,
            },
          ]),
          TE.mapLeft(ResponseErrorInternal),
        ),
      ),
      TE.bindW("assertionRefs", ({ popDocument, jwkPubKeyFromString }) =>
        pipe(
          getAllAssertionsRef(
            MASTER_HASH_ALGO,
            getAlgoFromAssertionRef(popDocument.assertionRef),
            jwkPubKeyFromString,
          ),
          eventLogger.taskEither.errorLeft((error) => [
            `${error.message}`,
            {
              assertion_ref,
              name: FN_LOG_NAME,
            },
          ]),
          TE.mapLeft((error) => ResponseErrorInternal(error.message)),
        ),
      ),
      TE.bindW(
        "retrievedPopDocument",
        ({ popDocument, assertionRefs, assertionFileName }) =>
          activatePubKeyForAssertionRef(popDocumentWriter, eventLogger)(
            assertionFileName,
            assertionRefs.master,
            body,
            popDocument.pubKey,
          ),
      ),
      TE.chain(
        ({
          assertionRefs,
          assertionFileName,
          popDocument,
          retrievedPopDocument,
        }) =>
          assertionRefs.used
            ? activatePubKeyForAssertionRef(popDocumentWriter, eventLogger)(
                assertionFileName,
                assertionRefs.used,
                body,
                popDocument.pubKey,
              )
            : TE.of(retrievedPopDocument),
      ),
      TE.chainW(
        flow(
          TE.fromPredicate(isValidLollipopPubKey, () =>
            pipe(
              `Unexpected retrievedPopDocument with a not VALID status`,
              eventLogger.peek.error((msg) => [
                `${msg}`,
                {
                  assertion_ref,
                  name: FN_LOG_NAME,
                },
              ]),
              ResponseErrorInternal,
            ),
          ),
          TE.map(retrievedLollipopKeysToApiActivatedPubKey),
          TE.map(ResponseSuccessJson),
        ),
      ),
      TE.toUnion,
    )();

export const ActivatePubKey = (
  publicKeyDocumentReader: PublicKeyDocumentReader,
  popDocumentWriter: PopDocumentWriter,
  assertionWriter: AssertionWriter,
  eventLogger: Logger,
) => {
  const handler = ActivatePubKeyHandler(
    publicKeyDocumentReader,
    popDocumentWriter,
    assertionWriter,
    eventLogger,
  );

  const middlewares = [
    ContextMiddleware(),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    RequiredBodyPayloadMiddleware(ActivatePubKeyPayload),
  ] as const;

  return wrapHandlerV4(middlewares, handler);
};
