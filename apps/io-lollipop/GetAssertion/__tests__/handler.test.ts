import * as TE from "fp-ts/TaskEither";

import { IAzureApiAuthorization } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/azure_api_auth";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";

import { PublicKeyDocumentReader } from "../../utils/readers";
import { GetAssertionHandler } from "../handler";
import {
  anAssertionContent,
  assertionReaderMock,
  publicKeyDocumentReaderMock
} from "../../__mocks__/readers.mock";
import { contextMock } from "../../__mocks__/context.mock";
import {
  aRetrievedValidLollipopPubKeySha256,
  aValidSha256AssertionRef,
  aValidSha512AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import { ErrorKind } from "../../utils/errors";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import { withApplicationInsight } from "@pagopa/io-functions-commons/dist/src/utils/transports/application_insight";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TelemetryClient } from "applicationinsights";
import { ResponseErrorForbiddenNotAuthorized } from "@pagopa/ts-commons/lib/responses";

const loggerMock = {
  trackEvent: jest.fn(e => {
    return void 0;
  })
};

const auth = ({
  subscription_id: "aValidSubscriptionId"
} as unknown) as IAzureApiAuthorization;

const aValidDecodedAuthJWT = {
  assertionRef: aValidSha256AssertionRef,
  operationId: "anOperationId" as NonEmptyString
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

describe("GetAssertionHandler - Success", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each`
    status
    ${PubKeyStatusEnum.VALID}
    ${PubKeyStatusEnum.REVOKED}
  `(
    `
  GIVEN a valid assertionRef and a valid jwt 
  WHEN the pub key is $status and the assertion exist
  THEN the assertion is returned
  `,
    async ({ status }) => {
      publicKeyDocumentReaderMock.mockImplementationOnce(
        (assertionRef: AssertionRef) =>
          TE.of({
            ...aRetrievedValidLollipopPubKeySha256,
            status,
            assertionRef: assertionRef,
            id: `${assertionRef}-000001`,
            version: 1
          }) as ReturnType<PublicKeyDocumentReader>
      );

      const handler = GetAssertionHandler(
        publicKeyDocumentReaderMock,
        assertionReaderMock
      );

      const res = await handler(
        auth,
        aValidSha256AssertionRef,
        aValidDecodedAuthJWT
      );

      expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
        aValidSha256AssertionRef
      );
      expect(assertionReaderMock).toHaveBeenCalledWith(
        aRetrievedValidLollipopPubKeySha256.assertionFileName
      );

      expect(contextMock.log.error).not.toHaveBeenCalled();
      expect(contextMock.log.info).toHaveBeenCalledWith(
        `Assertion ${aValidSha256AssertionRef} returned to service ${auth.subscriptionId}`
      );
      expect(loggerMock.trackEvent).toHaveBeenCalledWith({
        name: "lollipop.info.get-assertion",
        properties: {
          assertion_ref: aValidSha256AssertionRef,
          fiscal_code: sha256(aRetrievedValidLollipopPubKeySha256.fiscalCode),
          message: `Assertion ${aValidSha256AssertionRef} returned to service ${auth.subscriptionId}`,
          operation_id: aValidDecodedAuthJWT.operationId,
          subscription_id: auth.subscriptionId
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });

      expect(res).toMatchObject({
        kind: "IResponseSuccessJson",
        value: { response_xml: anAssertionContent }
      });
    }
  );
});

describe("GetAssertionHandler - Failure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`
  GIVEN a valid assertionRef and a valid jwt 
  WHEN the jwt does not contain the given assertionRef
  THEN an IResponseErrorForbiddenNotAuthorized is returned
  `, async () => {
    const handler = GetAssertionHandler(
      publicKeyDocumentReaderMock,
      assertionReaderMock
    );

    const anotherAssertionRef = aValidSha512AssertionRef;

    const res = await handler(auth, anotherAssertionRef, aValidDecodedAuthJWT);

    expect(publicKeyDocumentReaderMock).not.toHaveBeenCalled();
    expect(assertionReaderMock).not.toHaveBeenCalled();

    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.get-assertion",
      properties: {
        assertion_ref: anotherAssertionRef,
        message: `${ResponseErrorForbiddenNotAuthorized.detail} | jwt assertion_ref does not match the one in path`,
        operation_id: aValidDecodedAuthJWT.operationId,
        subscription_id: auth.subscriptionId
      },
      tagOverrides: { samplingEnabled: "false" }
    });

    expect(res).toMatchObject({
      kind: "IResponseErrorForbiddenNotAuthorized"
    });
  });

  test(`
  GIVEN a valid assertionRef and a valid jwt 
  WHEN the pub key is PENDING
  THEN an IResponseErrorInternal is returned
  `, async () => {
    const handler = GetAssertionHandler(
      publicKeyDocumentReaderMock,
      assertionReaderMock
    );

    const res = await handler(
      auth,
      aValidSha256AssertionRef,
      aValidDecodedAuthJWT
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionReaderMock).not.toHaveBeenCalled();

    expect(loggerMock.trackEvent).not.toHaveBeenCalled();

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: "Internal server error: Unexpected status on pubKey document"
    });
  });

  test(`
  GIVEN a valid assertionRef and a valid jwt
  WHEN an error occurred retrieving the pub key
  THEN an IResponseErrorInternal is returned
  `, async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({
        kind: ErrorKind.Internal,
        detail: "an Error",
        message: "another Error"
      })
    );

    const handler = GetAssertionHandler(
      publicKeyDocumentReaderMock,
      assertionReaderMock
    );

    const res = await handler(
      auth,
      aValidSha256AssertionRef,
      aValidDecodedAuthJWT
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionReaderMock).not.toHaveBeenCalled();

    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(
      "Error while reading pop document:  another Error | an Error"
    );

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: "Internal server error: an Error"
    });
  });

  test(`
  GIVEN a valid assertionRef and a valid jwt
  WHEN no pub key was found on db
  THEN an IResponseErrorGone is returned
  `, async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.NotFound })
    );

    const handler = GetAssertionHandler(
      publicKeyDocumentReaderMock,
      assertionReaderMock
    );

    const res = await handler(
      auth,
      aValidSha256AssertionRef,
      aValidDecodedAuthJWT
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionReaderMock).not.toHaveBeenCalled();

    expect(loggerMock.trackEvent).not.toHaveBeenCalled();

    expect(res).toMatchObject({
      kind: "IResponseErrorGone"
    });
  });

  test(`
  GIVEN a valid assertionRef and a valid jwt
  WHEN an error occurred retrieving the assertion
  THEN an IResponseErrorInternal is returned
  `, async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(
      (assertionRef: AssertionRef) =>
        TE.of({
          ...aRetrievedValidLollipopPubKeySha256,
          status: PubKeyStatusEnum.VALID,
          assertionRef: assertionRef,
          id: `${assertionRef}-000001`,
          version: 1
        }) as ReturnType<PublicKeyDocumentReader>
    );

    assertionReaderMock.mockImplementationOnce(() =>
      TE.left({
        kind: ErrorKind.Internal,
        detail: "an Error",
        message: "another Error"
      })
    );

    const handler = GetAssertionHandler(
      publicKeyDocumentReaderMock,
      assertionReaderMock
    );

    const res = await handler(
      auth,
      aValidSha256AssertionRef,
      aValidDecodedAuthJWT
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionReaderMock).toHaveBeenCalledWith(
      aRetrievedValidLollipopPubKeySha256.assertionFileName
    );

    expect(loggerMock.trackEvent).not.toHaveBeenCalled();

    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(
      "Error while reading assertion from blob storage: another Error | an Error"
    );

    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: "Internal server error: an Error"
    });
  });

  test(`
  GIVEN a valid assertionRef and a valid jwt
  WHEN the assertion was not found in blob storage
  THEN an IResponseErrorGone is returned
  `, async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(
      (assertionRef: AssertionRef) =>
        TE.of({
          ...aRetrievedValidLollipopPubKeySha256,
          status: PubKeyStatusEnum.VALID,
          assertionRef: assertionRef,
          id: `${assertionRef}-000001`,
          version: 1
        }) as ReturnType<PublicKeyDocumentReader>
    );

    assertionReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.NotFound })
    );

    const handler = GetAssertionHandler(
      publicKeyDocumentReaderMock,
      assertionReaderMock
    );

    const res = await handler(
      auth,
      aValidSha256AssertionRef,
      aValidDecodedAuthJWT
    );

    expect(publicKeyDocumentReaderMock).toHaveBeenCalledWith(
      aValidSha256AssertionRef
    );
    expect(assertionReaderMock).toHaveBeenCalledWith(
      aRetrievedValidLollipopPubKeySha256.assertionFileName
    );

    expect(loggerMock.trackEvent).not.toHaveBeenCalled();

    expect(res).toMatchObject({
      kind: "IResponseErrorGone"
    });
  });
});
