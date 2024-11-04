import * as crypto from "crypto";
import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe, flow } from "fp-ts/lib/function";
import { sequenceS } from "fp-ts/lib/Apply";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { format } from "date-fns";
import * as TE from "fp-ts/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import {
  JwkPublicKey,
  JwkPublicKeyFromToken
} from "@pagopa/ts-commons/lib/jwk";
import { DOMParser } from "@xmldom/xmldom";
import * as E from "fp-ts/Either";
import { upsertBlobFromObject } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import * as azureStorage from "azure-storage";
import * as t from "io-ts";
import {
  RequiredHeaderMiddleware,
  RequiredHeadersMiddleware
} from "../middlewares/request";
import { FastLoginResponse } from "../generated/definitions/internal/FastLoginResponse";
import {
  ASSERTION_REF_HEADER_NAME,
  FastLoginAdditionalHeaders,
  FastLoginAuditDoc,
  LollipopHeaders,
  PUBLIC_KEY_HEADER_NAME
} from "../types/lollipop";
import { FnLollipopClientDependency } from "../utils/lollipop/dependency";
import {
  calculateAssertionRef,
  getAlgoFromAssertionRef,
  getFiscalNumberFromSamlResponse,
  getRequestIDFromSamlResponse,
  isAssertionSaml
} from "../utils/lollipop/assertion";
import { LollipopAuthBearer } from "../generated/definitions/fn-lollipop/LollipopAuthBearer";
import { validateHttpSignature } from "../utils/lollipop/crypto";
import { AssertionRef } from "../generated/definitions/fn-lollipop/AssertionRef";
import { invalidate } from "../model/nonce";
import { CustomHttpUnauthorizedError, errorToHttpError } from "../utils/errors";
import { getNonceFromSignatureInput } from "../utils/lollipop/request";

/**
 * Retrieve the corrisponding SAMLResponse from the `io-fn-lollipop` related to a specific Lollipop sign request.
 *
 * @param {LollipopHeaders} lollipopHeaders The required Lollipop header included into the HTTP Request
 * @returns RTE with the lolliop client as Reader, HttpError as Left and FastLogin object as Right
 */
const RetrieveSAMLResponse: (
  lollipopHeaders: LollipopHeaders
) => RTE.ReaderTaskEither<
  FnLollipopClientDependency,
  H.HttpError,
  FastLoginResponse
> = (lollipopHeaders: LollipopHeaders) => ({ fnLollipopClient }) =>
  pipe(
    TE.tryCatch(
      () =>
        fnLollipopClient.getAssertion({
          assertion_ref: lollipopHeaders[ASSERTION_REF_HEADER_NAME],
          ["x-pagopa-lollipop-auth"]: `Bearer ${lollipopHeaders["x-pagopa-lollipop-auth-jwt"]}` as LollipopAuthBearer
        }),
      () => new H.HttpError("Error calling the getAssertion endpoint")
    ),
    TE.chainEitherK(
      E.mapLeft(_ => new H.HttpError("Unexpected response from fn-lollipop"))
    ),
    TE.chain(response =>
      response.status === 200
        ? TE.right(response.value)
        : TE.left(new H.HttpError("Error retrieving the SAML Assertion"))
    ),
    TE.filterOrElse(
      isAssertionSaml(lollipopHeaders["x-pagopa-lollipop-assertion-type"]),
      () => new H.HttpError("OIDC Claims not supported yet.")
    ),
    TE.map(assertion => ({ saml_response: assertion.response_xml }))
  );

export const StoreFastLoginAuditLogs: (
  fastLoginAuditLogDoc: FastLoginAuditDoc,
  logFileName: string
) => RTE.ReaderTaskEither<
  FnLollipopClientDependency,
  H.HttpError,
  azureStorage.BlobService.BlobResult
> = (fastLoginAuditLogDoc: FastLoginAuditDoc, logFileName: string) => ({
  blobService
}) =>
  pipe(
    TE.tryCatch(
      () =>
        upsertBlobFromObject(
          blobService,
          "logs",
          logFileName,
          FastLoginAuditDoc.encode(fastLoginAuditLogDoc)
        ),
      err => new H.HttpError(`Unexpected error: [${E.toError(err).message}]`)
    ),
    TE.chainEitherK(
      E.mapLeft(
        err =>
          new H.HttpError(
            `An error occurred saving the audit log: [${err.message}]`
          )
      )
    ),
    TE.chain(
      TE.fromOption(() => new H.HttpError("The audit log was not saved"))
    )
  );

type Verifier = (assertion: Document) => TE.TaskEither<H.HttpError, true>;

/**
 * Check if the InResponseTo field included into the SAMLResponse match with the provided parameters.
 *
 * @param {JwkPublicKey} pubKey The decoded pubkey from HTTP Request header `x-pagopa-lollipop-public-key`
 * @param {AssertionRef} assertionRefFromHeader The assertion ref from the HTTP Request header `x-pagopa-lollipop-assertion-ref`
 * @returns The Verifier function
 */
export const getAssertionRefVsInRensponseToVerifier = (
  pubKey: JwkPublicKey,
  assertionRefFromHeader: AssertionRef
): Verifier => (assertionDoc): ReturnType<Verifier> =>
  pipe(
    assertionDoc,
    getRequestIDFromSamlResponse,
    TE.fromOption(
      () =>
        new H.HttpError("Missing request id in the retrieved saml assertion.")
    ),
    TE.filterOrElse(
      AssertionRef.is,
      () =>
        new H.HttpError(
          "InResponseTo in the assertion do not contains a valid Assertion Ref."
        )
    ),
    TE.bindTo("inResponseTo"),
    TE.bind("algo", ({ inResponseTo }) =>
      TE.of(getAlgoFromAssertionRef(inResponseTo))
    ),
    TE.chain(({ inResponseTo, algo }) =>
      pipe(
        pubKey,
        calculateAssertionRef(algo),
        TE.mapLeft(
          e =>
            new H.HttpError(
              `Error calculating the hash of the provided public key: ${e.message}`
            )
        ),
        TE.filterOrElse(
          calcAssertionRef =>
            calcAssertionRef === inResponseTo &&
            assertionRefFromHeader === inResponseTo,
          calcAssertionRef =>
            new H.HttpError(
              `The hash of provided public key do not match the InReponseTo in the assertion: fromSaml=${inResponseTo},fromPublicKey=${calcAssertionRef},fromHeader=${assertionRefFromHeader}`
            )
        )
      )
    ),
    TE.map(() => true as const)
  );

/**
 * Check if the Fiscal Number included into the SAMLResponse match with the provided parameter.
 *
 * @param {FiscalCode} fiscalCodeFromHeader The Fiscal Number from the HTTP Request header `x-pagopa-lollipop-user-id`
 * @returns The Verifier function
 */
export const getAssertionUserIdVsCfVerifier = (
  fiscalCodeFromHeader: FiscalCode
): Verifier => (assertionDoc): ReturnType<Verifier> =>
  pipe(
    assertionDoc,
    getFiscalNumberFromSamlResponse,
    TE.fromOption(
      () =>
        new H.HttpError(
          "Missing or invalid Fiscal Code in the retrieved saml assertion."
        )
    ),
    TE.filterOrElse(
      fiscalCodeFromAssertion =>
        fiscalCodeFromAssertion === fiscalCodeFromHeader,
      fiscalCodeFromAssertion =>
        new H.HttpError(
          `The provided user id do not match the fiscalNumber in the assertion: fromSaml=${fiscalCodeFromAssertion},fromHeader=${fiscalCodeFromHeader}`
        )
    ),
    TE.map(() => true as const)
  );

const deleteNonce: (
  lollipopHeaders: LollipopHeaders
) => RTE.ReaderTaskEither<
  FnLollipopClientDependency,
  H.HttpError,
  true
> = lollipopHeaders => ({ redisClientTask }) =>
  pipe(
    TE.fromEither(
      getNonceFromSignatureInput(lollipopHeaders["signature-input"])
    ),
    TE.mapLeft(
      error =>
        new CustomHttpUnauthorizedError(
          `Invalid or missing nonce in request: [${error.message}]`
        )
    ),
    TE.chain(nonce =>
      pipe(
        redisClientTask,
        TE.mapLeft(errorToHttpError),
        TE.chainW(
          flow(
            invalidate(nonce),
            TE.mapLeft(
              error =>
                new CustomHttpUnauthorizedError(
                  `Could not delete nonce: [${error.message}]`
                )
            )
          )
        )
      )
    )
  );

export const makeFastLoginHandler: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<FastLoginResponse, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  FnLollipopClientDependency
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    sequenceS(RTE.ApplyPar)({
      // The exact decode is required to remove additional headers with security information like auth token
      lollipopHeaders: RequiredHeadersMiddleware(t.exact(LollipopHeaders)),
      lvAdditionalHeaders: RequiredHeadersMiddleware(
        t.exact(FastLoginAdditionalHeaders)
      ),
      publicKey: RequiredHeaderMiddleware(
        JwkPublicKeyFromToken,
        PUBLIC_KEY_HEADER_NAME
      )
    }),
    TE.chainFirstW(verifiedHeaders =>
      validateHttpSignature({
        assertionRef:
          verifiedHeaders.lollipopHeaders[ASSERTION_REF_HEADER_NAME],
        publicKey: verifiedHeaders.publicKey,
        request: req
      })
    ),
    RTE.fromTaskEither,
    RTE.bindTo("verifiedHeaders"),
    RTE.chainFirst(({ verifiedHeaders }) =>
      deleteNonce(verifiedHeaders.lollipopHeaders)
    ),
    RTE.bindW("samlResponse", ({ verifiedHeaders }) =>
      RetrieveSAMLResponse(verifiedHeaders.lollipopHeaders)
    ),
    RTE.bindW("samlResponseDoc", ({ samlResponse }) =>
      pipe(
        TE.tryCatch(
          async () =>
            new DOMParser().parseFromString(
              samlResponse.saml_response,
              "text/xml"
            ),
          () => new H.HttpError("Error parsing the SAMLResponse")
        ),
        RTE.fromTaskEither
      )
    ),
    RTE.chainFirstW(({ verifiedHeaders, samlResponseDoc }) =>
      pipe(
        [
          getAssertionRefVsInRensponseToVerifier(
            verifiedHeaders.publicKey,
            verifiedHeaders.lollipopHeaders[ASSERTION_REF_HEADER_NAME]
          ),
          getAssertionUserIdVsCfVerifier(
            verifiedHeaders.lollipopHeaders["x-pagopa-lollipop-user-id"]
          )
        ],
        RA.map(verifier => verifier(samlResponseDoc)),
        TE.sequenceArray,
        RTE.fromTaskEither
      )
    ),
    RTE.chainFirstW(({ verifiedHeaders, samlResponse }) => {
      const fastLoginAuditLogDoc: FastLoginAuditDoc = {
        assertion_xml: samlResponse.saml_response,
        client_ip: verifiedHeaders.lvAdditionalHeaders["x-pagopa-lv-client-ip"],
        created_at: new Date(),
        lollipop_request: {
          body: req.body,
          headers: verifiedHeaders.lollipopHeaders
        }
      };

      // Generate the filename
      // Formatted like `AAAAAA01B02C345D-2023-01-01T13-55-54-sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU-198a36`
      const auditLogFilename = `${
        verifiedHeaders.lollipopHeaders["x-pagopa-lollipop-user-id"]
      }-${format(fastLoginAuditLogDoc.created_at, "yyyy-MM-dd'T'HH-mm-ss")}-${
        verifiedHeaders.lollipopHeaders[ASSERTION_REF_HEADER_NAME]
      }-${crypto.randomBytes(3).toString("hex")}`;

      // Save the document into the audit log blob storage
      return StoreFastLoginAuditLogs(fastLoginAuditLogDoc, auditLogFilename);
    }),
    RTE.map(({ samlResponse }) => samlResponse),
    RTE.map(H.successJson),
    RTE.orElseW(error =>
      RTE.right(H.problemJson({ status: error.status, title: error.message }))
    )
  )
);

export const FastLoginFunction = httpAzureFunction(makeFastLoginHandler);
