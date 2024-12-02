import * as date_fns from "date-fns";

import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";

import { withApplicationInsight } from "@pagopa/io-functions-commons/dist/src/utils/transports/application_insight";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";

import * as TE from "fp-ts/lib/TaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { GenerateLcParamsPayload } from "../../generated/definitions/internal/GenerateLcParamsPayload";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";

import {
  NotPendingLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE
} from "../../model/lollipop_keys";
import { PublicKeyDocumentReader } from "../../utils/readers";
import { ErrorKind } from "../../utils/errors";

import { GenerateLCParamsHandler } from "../handler";

import {
  aLolliPopPubKeys,
  anAssertionRef,
  aPendingLolliPopPubKeys,
  aRetrievedLolliPopPubKeys
} from "../../__mocks__/lollipopkeysMock";
import { contextMock, telemetryClientMock } from "../../__mocks__/context.mock";

const azureContextTransport = new AzureContextTransport(
  () => contextMock.log,
  {}
);
useWinstonFor({
  loggerId: LoggerId.event,
  transports: [
    withApplicationInsight(telemetryClientMock, "lollipop"),
    azureContextTransport
  ]
});
useWinstonFor({
  loggerId: LoggerId.default,
  transports: [azureContextTransport]
});

const anAuthJwt = "anAuthJwt" as NonEmptyString;
const defaultGracePeriod = 30 as NonNegativeInteger;
const anExpiredOutOfGracePeriodDate = date_fns.addDays(
  new Date(),
  -defaultGracePeriod - 1
);
const anExpiredInGracePeriodDate = date_fns.addDays(
  new Date(),
  -defaultGracePeriod + 1
);

const aValidGenerateLcParamsPayload: GenerateLcParamsPayload = {
  operation_id: "1" as NonEmptyString
};

const aValidRetrievedLollipopPubKey: NotPendingLolliPopPubKeys = {
  ...aRetrievedLolliPopPubKeys,
  ...aLolliPopPubKeys
};

const publicKeyDocumentReaderMock = jest
  .fn()
  .mockImplementation(
    () =>
      TE.of(aValidRetrievedLollipopPubKey) as ReturnType<
        PublicKeyDocumentReader
      >
  );
const anAuthJwtGeneratorMock = jest
  .fn()
  .mockImplementation(_ => TE.of(anAuthJwt));

describe("GenerateLCParamsHandler", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos fail THEN it should return an Internal server error", async () => {
    const errorDetails = "an Error Detail";
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.Internal, detail: errorDetails })
    );
    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(
      `Error retrieving assertionRef ${anAssertionRef} from Cosmos: ${ErrorKind.Internal} [${errorDetails}]`
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(0);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining(errorDetails)
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns none THEN it should return Not Found", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.NotFound })
    );
    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(
      `Error retrieving assertionRef ${anAssertionRef} from Cosmos: ${ErrorKind.NotFound}`
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(0);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorNotFound",
        detail: "NotFound: Could not find requested resource"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns a pending lollipopPubKeys THEN it should return Forbidden", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aPendingLolliPopPubKeys)
    );
    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(
      `Unexpected status on pop document: expected ${PubKeyStatusEnum.VALID}, found ${aPendingLolliPopPubKeys.status}`
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns an expired lollipopPubKeys THEN it should return Forbidden", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right({
        ...aValidRetrievedLollipopPubKey,
        expiredAt: anExpiredOutOfGracePeriodDate
      })
    );
    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    const expectedMessage = `Pop document expired at ${anExpiredOutOfGracePeriodDate} with grace period of ${defaultGracePeriod} days`;
    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(expectedMessage);
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.generate-lc-params",
      properties: {
        assertion_ref: anAssertionRef,
        message: expectedMessage,
        operation_id: aValidGenerateLcParamsPayload.operation_id
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized"
      })
    );
  });

  it("GIVEN a valid input WHEN LC auth Jwt generation fails THEN returns Internal Server Error", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aValidRetrievedLollipopPubKey)
    );

    const errorMsg = "Cannot generate JWT";
    anAuthJwtGeneratorMock.mockImplementationOnce(() =>
      TE.left(Error(errorMsg))
    );

    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(anAuthJwtGeneratorMock).toHaveBeenCalledWith({
      assertionRef: anAssertionRef,
      operationId: aValidGenerateLcParamsPayload.operation_id
    });

    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledWith(
      `Internal server error: Cannot generate LC Auth JWT|ERROR=${errorMsg}`
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(0);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns an expired lollipopPubKeys in gracePeriod THEN it should return success", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right({
        ...aValidRetrievedLollipopPubKey,
        expiredAt: anExpiredInGracePeriodDate
      })
    );
    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(anAuthJwtGeneratorMock).toHaveBeenCalledWith({
      assertionRef: anAssertionRef,
      operationId: aValidGenerateLcParamsPayload.operation_id
    });

    expect(contextMock.log.error).toHaveBeenCalledTimes(0);
    expect(contextMock.log.info).toHaveBeenCalledTimes(1);
    expect(contextMock.log.info).toHaveBeenCalledWith(
      `LC Params successfully generated for assertionRef ${anAssertionRef} and operationId ${aValidGenerateLcParamsPayload.operation_id}`
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.info.generate-lc-params",
      properties: {
        assertion_ref: anAssertionRef,
        message: `LC Params successfully generated for assertionRef ${anAssertionRef} and operationId ${aValidGenerateLcParamsPayload.operation_id}`,
        operation_id: aValidGenerateLcParamsPayload.operation_id
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessJson"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns a valid lollipopPubKeys THEN it should return success", async () => {
    publicKeyDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aValidRetrievedLollipopPubKey)
    );
    const result = await GenerateLCParamsHandler(
      publicKeyDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(anAuthJwtGeneratorMock).toHaveBeenCalledWith({
      assertionRef: anAssertionRef,
      operationId: aValidGenerateLcParamsPayload.operation_id
    });

    expect(contextMock.log.error).toHaveBeenCalledTimes(0);
    expect(contextMock.log.info).toHaveBeenCalledTimes(1);
    expect(contextMock.log.info).toHaveBeenCalledWith(
      `LC Params successfully generated for assertionRef ${anAssertionRef} and operationId ${aValidGenerateLcParamsPayload.operation_id}`
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.info.generate-lc-params",
      properties: {
        assertion_ref: anAssertionRef,
        message: `LC Params successfully generated for assertionRef ${anAssertionRef} and operationId ${aValidGenerateLcParamsPayload.operation_id}`,
        operation_id: aValidGenerateLcParamsPayload.operation_id
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessJson",
        value: expect.objectContaining({
          assertion_file_name: aValidRetrievedLollipopPubKey.assertionFileName,
          assertion_ref: aValidRetrievedLollipopPubKey.assertionRef,
          assertion_type: aValidRetrievedLollipopPubKey.assertionType,
          fiscal_code: aValidRetrievedLollipopPubKey.fiscalCode,
          lc_authentication_bearer: anAuthJwt,
          pub_key: aValidRetrievedLollipopPubKey.pubKey,
          status: aValidRetrievedLollipopPubKey.status,
          ttl: TTL_VALUE_AFTER_UPDATE
        })
      })
    );
  });
});
