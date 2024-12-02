import * as jose from "jose";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import {
  NewLolliPopPubKeys,
  RetrievedLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE
} from "../../model/lollipop_keys";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AssertionTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { ActivatePubKeyHandler } from "../handler";
import { PublicKeyDocumentReader } from "../../utils/readers";
import { AssertionWriter, PopDocumentWriter } from "../../utils/writers";
import { ActivatePubKeyPayload } from "../../generated/definitions/internal/ActivatePubKeyPayload";
import {
  retrievedLollipopKeysToApiActivatedPubKey,
  RetrievedValidPopDocument
} from "../../utils/lollipopKeys";
import { getAllAssertionsRef } from "../../utils/lollipopKeys";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import {
  aCosmosResourceMetadata,
  aRetrievedPendingLollipopPubKeySha256,
  aRetrievedValidLollipopPubKeySha256,
  aValidJwk,
  aValidSha256AssertionRef,
  aValidSha512AssertionRef,
  toEncodedJwk
} from "../../__mocks__/lollipopPubKey.mock";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";
import { ErrorKind, InternalError } from "../../utils/errors";
import { contextMock } from "../../__mocks__/context.mock";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";
import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import { withApplicationInsight } from "@pagopa/io-functions-commons/dist/src/utils/transports/application_insight";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TelemetryClient } from "applicationinsights";

const aFiscalCode = "SPNDNL80A13Y555X" as FiscalCode;
const expiresAtDate = new Date(); // Now

const aValidRetrievedPopDocument: RetrievedLolliPopPubKeys = {
  pubKey: toEncodedJwk(aValidJwk),
  ttl: TTL_VALUE_AFTER_UPDATE,
  assertionType: AssertionTypeEnum.SAML,
  assertionRef: aValidSha256AssertionRef,
  assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}` as AssertionFileName,
  status: PubKeyStatusEnum.VALID,
  fiscalCode: aFiscalCode,
  expiredAt: expiresAtDate,
  id: "1" as NonEmptyString,
  version: 1 as NonNegativeInteger,
  ...aCosmosResourceMetadata
};

const aPendingRetrievedPopDocument: RetrievedLolliPopPubKeys = {
  ...aValidRetrievedPopDocument,
  status: PubKeyStatusEnum.PENDING
};

const aValidRetrievedPopDocumentWithMasterAlgo: RetrievedValidPopDocument = {
  ...aValidRetrievedPopDocument,
  assertionRef: aValidSha512AssertionRef,
  assertionFileName: `${aFiscalCode}-${aValidSha512AssertionRef}` as AssertionFileName
};

const aPendingRetrievedPopDocumentWithMasterAlgo = {
  ...aPendingRetrievedPopDocument,
  // to let this document match the master we must change the assertionRef
  // to a sha512 one
  assertionRef: aValidSha512AssertionRef,
  assertionFileName: `${aFiscalCode}-${aValidSha512AssertionRef}`
};

const publicKeyDocumentReaderMock = jest.fn(
  (assertionRef: AssertionRef) =>
    TE.of({
      ...aRetrievedPendingLollipopPubKeySha256,
      assertionRef: assertionRef,
      id: `${assertionRef}-000000`,
      version: 0
    }) as ReturnType<PublicKeyDocumentReader>
);

const popDocumentWriterMock = jest.fn(
  (item: NewLolliPopPubKeys) =>
    TE.of({
      ...aRetrievedPendingLollipopPubKeySha256,
      ...item,
      id: `${item.assertionRef}-000001`,
      version: 1,
      ttl: TTL_VALUE_AFTER_UPDATE
    }) as ReturnType<PopDocumentWriter>
);
const assertionWriterMock = jest.fn(
  () => TE.of(true) as ReturnType<AssertionWriter>
);

const aValidPayload: ActivatePubKeyPayload = {
  fiscal_code: aFiscalCode,
  assertion: "an assertion" as NonEmptyString,
  assertion_type: AssertionTypeEnum.SAML,
  expired_at: expiresAtDate
};

const FN_LOG_NAME = "activate-pubkey";

const loggerMock = {
  trackEvent: jest.fn(e => {
    return void 0;
  })
};

const azureContextTransport = new AzureContextTransport(
  () => contextMock.log,
  {}
);
useWinstonFor({
  loggerId: LoggerId.event,
  transports: [
    withApplicationInsight(
      (loggerMock as unknown) as TelemetryClient,
      "lollipop"
    ),
    azureContextTransport
  ]
});
useWinstonFor({
  loggerId: LoggerId.default,
  transports: [azureContextTransport]
});

describe("activatePubKey handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should success given valid informations when used algo DIFFERENT FROM master algo", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aPendingRetrievedPopDocument)
    );

    const activatePubKeyHandler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const aValidActivatePubKeyPayload: ActivatePubKeyPayload = {
      fiscal_code: aFiscalCode,
      expired_at: expiresAtDate,
      assertion_type: AssertionTypeEnum.SAML,
      assertion: "" as NonEmptyString
    };

    const assertionRefsResult = await getAllAssertionsRef(
      JwkPubKeyHashAlgorithmEnum.sha512,
      JwkPubKeyHashAlgorithmEnum.sha256,
      aValidJwk
    )();

    if (E.isLeft(assertionRefsResult)) fail();

    const res = await activatePubKeyHandler(
      contextMock,
      aValidSha256AssertionRef,
      aValidActivatePubKeyPayload
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledTimes(1);
    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).toHaveBeenCalledTimes(1);
    expect(assertionWriterMock).toHaveBeenCalledWith(
      `${aValidActivatePubKeyPayload.fiscal_code}-${aValidSha256AssertionRef}`,
      ""
    );
    expect(popDocumentWriterMock).toHaveBeenCalledTimes(2);
    expect(popDocumentWriterMock).toHaveBeenNthCalledWith(1, {
      pubKey: aPendingRetrievedPopDocument.pubKey,
      // the assertion Ref for masterKey is created by the getAllAssertionRefs method
      assertionRef: assertionRefsResult.right.master,
      assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}`,
      status: PubKeyStatusEnum.VALID,
      assertionType: aValidActivatePubKeyPayload.assertion_type,
      fiscalCode: aValidActivatePubKeyPayload.fiscal_code,
      expiredAt: expiresAtDate
    });
    expect(popDocumentWriterMock).toHaveBeenNthCalledWith(2, {
      pubKey: aPendingRetrievedPopDocument.pubKey,
      assertionRef: aValidSha256AssertionRef,
      assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}`,
      status: PubKeyStatusEnum.VALID,
      assertionType: aValidActivatePubKeyPayload.assertion_type,
      fiscalCode: aValidActivatePubKeyPayload.fiscal_code,
      expiredAt: expiresAtDate
    });

    expect(res.kind).toBe("IResponseSuccessJson");
    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: retrievedLollipopKeysToApiActivatedPubKey(
        aValidRetrievedPopDocument
      )
    });
  });

  it("should success given valid informations when used algo EQUALS TO master algo", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aPendingRetrievedPopDocumentWithMasterAlgo)
    );

    const activatePubKeyHandler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const aValidActivatePubKeyPayload: ActivatePubKeyPayload = {
      fiscal_code: aFiscalCode,
      expired_at: expiresAtDate,
      assertion_type: AssertionTypeEnum.SAML,
      assertion: "" as NonEmptyString
    };

    const assertionRefsResult = await getAllAssertionsRef(
      JwkPubKeyHashAlgorithmEnum.sha512,
      JwkPubKeyHashAlgorithmEnum.sha512,
      aValidJwk
    )();

    if (E.isLeft(assertionRefsResult)) fail();

    const res = await activatePubKeyHandler(
      contextMock,
      aValidSha512AssertionRef,
      aValidActivatePubKeyPayload
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledTimes(1);
    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha512AssertionRef
    );
    expect(assertionWriterMock).toHaveBeenCalledTimes(1);
    expect(assertionWriterMock).toHaveBeenCalledWith(
      `${aValidActivatePubKeyPayload.fiscal_code}-${aValidSha512AssertionRef}`,
      ""
    );
    expect(popDocumentWriterMock).toHaveBeenCalledTimes(1);
    expect(popDocumentWriterMock).toHaveBeenCalledWith({
      pubKey: aPendingRetrievedPopDocument.pubKey,
      // the assertion Ref for masterKey is created by the getAllAssertionRefs method
      assertionRef: assertionRefsResult.right.master,
      assertionFileName: `${aFiscalCode}-${aValidSha512AssertionRef}`,
      status: PubKeyStatusEnum.VALID,
      assertionType: aValidActivatePubKeyPayload.assertion_type,
      fiscalCode: aValidActivatePubKeyPayload.fiscal_code,
      expiredAt: expiresAtDate
    });

    expect(res.kind).toBe("IResponseSuccessJson");
    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: retrievedLollipopKeysToApiActivatedPubKey(
        aValidRetrievedPopDocumentWithMasterAlgo
      )
    });
  });
});

describe("ActivatePubKey - Errors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 500 Error when assertionRef doen not exists", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.NotFound })
    );

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `Error while reading pop document: ${ErrorKind.NotFound}`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail:
        "Internal server error: Error while reading pop document: NotFound"
    });

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).not.toHaveBeenCalled();
    expect(popDocumentWriterMock).not.toHaveBeenCalled();
  });

  it("should return 403 Forbidden Not Authorized when a pop document with status DIFFERENT FROM PENDING is found", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(assertionRef =>
      TE.of({
        ...aRetrievedValidLollipopPubKeySha256,
        assertionRef: assertionRef,
        id: `${assertionRef}-000000` as NonEmptyString,
        version: 0 as NonNegativeInteger,
        status: PubKeyStatusEnum.REVOKED
      })
    );

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `Unexpected status on pop document during activation: ${PubKeyStatusEnum.REVOKED}`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject(
      expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized"
      })
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).not.toHaveBeenCalled();
    expect(popDocumentWriterMock).not.toHaveBeenCalled();
  });

  it("should return 500 Internal Error when an error occurred reading document", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({
        kind: ErrorKind.Internal,
        detail: "an Error",
        message: "a detail Error"
      })
    );

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `Error while reading pop document: ${ErrorKind.Internal}`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail:
        "Internal server error: Error while reading pop document: Internal"
    });

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).not.toHaveBeenCalled();
    expect(popDocumentWriterMock).not.toHaveBeenCalled();
  });

  it("should return 500 Internal Error when AssertionFileName fail decoding", async () => {
    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(contextMock, aValidSha256AssertionRef, {
      ...aValidPayload,
      fiscal_code: "invalid_fiscal_code" as FiscalCode // this will make AssertionFileName decoder fail
    });

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `Could not decode assertionFileName`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail:
        'Internal server error: Could not decode assertionFileName'
    });

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).not.toHaveBeenCalled();
    expect(popDocumentWriterMock).not.toHaveBeenCalled();
  });

  it("should return 500 Internal Error when an error occurred writing assertion into storage", async () => {
    assertionWriterMock.mockImplementationOnce(() =>
      TE.left({
        kind: ErrorKind.Internal,
        detail: "an Error on storage",
        message: "a detail Error on storage"
      })
    );

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `an Error on storage`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: "Internal server error: an Error on storage"
    });

    const expectedResult = {
      assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}`
    };

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).toHaveBeenCalledWith(
      expectedResult.assertionFileName,
      aValidPayload.assertion
    );
    expect(popDocumentWriterMock).not.toHaveBeenCalled();
  });

  it("should return 500 Internal Error when JwkPublicKeyFromToken fail decoding", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(
      () =>
        TE.of({
          ...aRetrievedPendingLollipopPubKeySha256,
          pubKey: "", // this will make JwkPublicKeyFromToken decoder fail
          assertionRef: aValidSha256AssertionRef,
          id: `${aValidSha256AssertionRef}-000000`,
          version: 0
        }) as ReturnType<PublicKeyDocumentReader>
    );

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `Could not decode public key | value \"\" at root is not a valid [JwkPublicKeyFromToken]`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail:
        'Internal server error: Could not decode public key | value "" at root is not a valid [JwkPublicKeyFromToken]'
    });

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(popDocumentWriterMock).not.toHaveBeenCalled();
  });

  it("should return 500 Internal Error when an error occurred storing master key", async () => {
    const error = {
      kind: ErrorKind.Internal,
      detail: "an Error on cosmos update",
      message: "a detail Error on cosmos update"
    } as InternalError;

    popDocumentWriterMock.mockImplementationOnce(() => TE.left(error));

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha512AssertionRef,
        message: `Error while writing pop document: ${error.kind} - ${error.detail} - ${error.message}`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: "Internal server error: an Error on cosmos update"
    });

    const expectedResult = {
      assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}`
    };

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).toHaveBeenCalledWith(
      expectedResult.assertionFileName,
      aValidPayload.assertion
    );
    expect(popDocumentWriterMock).toHaveBeenCalledTimes(1);
  });

  it("should return 500 Internal Error when an error occurred storing used key", async () => {
    const error = {
      kind: ErrorKind.Internal,
      detail: "an Error on cosmos update",
      message: "a detail Error on cosmos update"
    } as InternalError;

    popDocumentWriterMock
      // First insert OK
      .mockImplementationOnce(
        (item: NewLolliPopPubKeys) =>
          TE.of({
            ...aRetrievedPendingLollipopPubKeySha256,
            ...item,
            id: `${item.assertionRef}-000001`,
            version: 1
          }) as ReturnType<PopDocumentWriter>
      )
      // Second insert KO
      .mockImplementationOnce(() => TE.left(error));

    const handler = ActivatePubKeyHandler(
      publicKeyDocumentReaderMock,
      popDocumentWriterMock,
      assertionWriterMock
    );

    const res = await handler(
      contextMock,
      aValidSha256AssertionRef,
      aValidPayload
    );

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.activate-pubkey",
      properties: {
        assertion_ref: aValidSha256AssertionRef,
        message: `Error while writing pop document: ${error.kind} - ${error.detail} - ${error.message}`
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: "Internal server error: an Error on cosmos update"
    });

    const expectedResult = {
      assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}`
    };

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionWriterMock).toHaveBeenCalledWith(
      expectedResult.assertionFileName,
      aValidPayload.assertion
    );
    expect(popDocumentWriterMock).toHaveBeenCalledTimes(2);
  });
});
