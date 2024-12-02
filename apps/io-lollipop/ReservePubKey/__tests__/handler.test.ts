import * as TE from "fp-ts/TaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import {
  LolliPOPKeysModel,
  PendingLolliPopPubKeys,
  TTL_VALUE_FOR_RESERVATION
} from "../../model/lollipop_keys";
import { encodeBase64 } from "../../utils/thumbprint";
import { MASTER_HASH_ALGO } from "../../utils/lollipopKeys";
import {
  aSha256PubKeyThumbprint,
  aSha512PubKey,
  aSha512PubKeyThumbprint
} from "../../__mocks__/jwkMock";
import {
  aCosmosResourceMetadata,
  mockContainer
} from "../../__mocks__/lollipopkeysMock";
import * as handler from "../handler";
import { AssertionRef } from "../../generated/definitions/external/AssertionRef";
import { contextMock } from "../../__mocks__/context.mock";
import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import { withApplicationInsight } from "@pagopa/io-functions-commons/dist/src/utils/transports/application_insight";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { TelemetryClient } from "applicationinsights";

const mockCreatePendingLollipop = (pendingLollipop: PendingLolliPopPubKeys) =>
  Promise.resolve({
    resource: {
      ...pendingLollipop,
      ...aCosmosResourceMetadata,
      id: `${pendingLollipop.assertionRef}-${"0".repeat(16)}` as NonEmptyString,
      ttl: TTL_VALUE_FOR_RESERVATION,
      version: 0 as NonNegativeInteger
    }
  });

const FN_LOG_NAME = "reserve-pubkey";

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

const lollipopKeysUtils = require("../../utils/lollipopKeys");
const getAllAssertionsRef = jest.spyOn(
  lollipopKeysUtils,
  "getAllAssertionsRef"
);

describe("reserveSingleKey", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  test("GIVEN a working model WHEN reserve a pub_key THEN call the cosmos create and return the RetriveLollipop", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);

    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}` as AssertionRef;
    const result = await handler.reserveSingleKey(
      model,
      pubKey.pub_key
    )(assertionRef)();
    expect(result).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({ assertionRef })
      })
    );
    expect(mockedContainer.mock.create).toHaveBeenCalledWith(
      {
        assertionRef,
        pubKey: encodeBase64(pubKey.pub_key),
        status: PubKeyStatusEnum.PENDING,
        id: `${assertionRef}-0000000000000000`,
        ttl: TTL_VALUE_FOR_RESERVATION,
        version: 0
      },
      expect.anything()
    );
  });

  test("GIVEN a not working model WHEN reserve a pub_key THEN return an Internal Error Response containing a Cosmos Error", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(() => "");

    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}` as AssertionRef;
    const result = await handler.reserveSingleKey(
      model,
      pubKey.pub_key
    )(assertionRef)();

    // By raising an event within reserveSingleKey,
    // it will be duplicated most of the times (by default masterAlgo != usedAlgo).
    // We will raise just one event from the caller.
    expect(loggerMock.trackEvent).toHaveBeenCalledTimes(0);

    expect(result).toEqual(
      expect.objectContaining({
        left: expect.objectContaining({
          kind: "IResponseErrorInternal",
          detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
        })
      })
    );
  });
});

describe("reservePubKeys", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  test("GIVEN a working model WHEN getAllAssertionsRef fails THEN an internal error is returned", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);

    getAllAssertionsRef.mockImplementationOnce(() =>
      TE.left(Error("an error in getAllAssertionsRef"))
    );

    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const result = await handler.reservePubKeys(model)(pubKey);

    expect(loggerMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.reserve-pubkey",
      properties: {
        message: "Error - an error in getAllAssertionsRef"
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal"
      })
    );
  });

  test("GIVEN a working model WHEN reserve a master pub_key THEN store it and return a redirect containing the assertion ref ", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const result = await handler.reservePubKeys(model)(pubKey);
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}`;
    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessRedirectToResource",
        detail: `/pubKeys/${assertionRef}`,
        payload: expect.objectContaining({
          assertion_ref: assertionRef,
          pub_key: encodeBase64(pubKey.pub_key)
        }),
        resource: expect.objectContaining({ assertion_ref: assertionRef })
      })
    );
  });

  test("GIVEN a working model WHEN reserve a non-master pub_key THEN store both master and non-master pub_key and return a redirect containing the assertion ref ", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = {
      ...aSha512PubKey,
      algo: JwkPubKeyHashAlgorithmEnum.sha256
    };
    const result = await handler.reservePubKeys(model)(pubKey);
    const assertionRef = `${pubKey.algo}-${aSha256PubKeyThumbprint}`;
    const masterAssertionRef = `${MASTER_HASH_ALGO}-${aSha512PubKeyThumbprint}`;
    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(2);
    expect(mockedContainer.mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ assertionRef: masterAssertionRef }),
      expect.anything()
    );
    expect(mockedContainer.mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ assertionRef }),
      expect.anything()
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessRedirectToResource",
        detail: `/pubKeys/${assertionRef}`,
        payload: expect.objectContaining({
          assertion_ref: assertionRef,
          pub_key: encodeBase64(pubKey.pub_key)
        }),
        resource: expect.objectContaining({ assertion_ref: assertionRef })
      })
    );
  });

  test("GIVEN a not working model WHEN reserve a master pub_key THEN return an internal error response containing a Cosmos Error", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(() => "");
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const result = await handler.reservePubKeys(model)(pubKey);

    expect(loggerMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.reserve-pubkey",
      properties: {
        message: `Error reserving keys: Internal server error: ${JSON.stringify(
          { error: {}, kind: "COSMOS_ERROR_RESPONSE" }
        )}`,
        masterKey:
          "sha512-WbgQ6E5Rzdj1HSBkRQbZ_CMI2O9IDReGkb-CcJIuv7dS8GKWrC4EPxy4rWXfQ9F-JWz-67VYfKRjS3m7uc8wBQ",
        usedKey:
          "sha512-WbgQ6E5Rzdj1HSBkRQbZ_CMI2O9IDReGkb-CcJIuv7dS8GKWrC4EPxy4rWXfQ9F-JWz-67VYfKRjS3m7uc8wBQ"
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
      })
    );
  });

  test("GIVEN a not working model WHEN reserve a non-master pub_key THEN return an internal error response containing a Cosmos Error", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(() => "");
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = {
      ...aSha512PubKey,
      algo: JwkPubKeyHashAlgorithmEnum.sha256
    };
    const result = await handler.reservePubKeys(model)(pubKey);

    expect(loggerMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(loggerMock.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.reserve-pubkey",
      properties: {
        message: `Error reserving keys: Internal server error: ${JSON.stringify(
          { error: {}, kind: "COSMOS_ERROR_RESPONSE" }
        )}`,
        masterKey:
          "sha512-WbgQ6E5Rzdj1HSBkRQbZ_CMI2O9IDReGkb-CcJIuv7dS8GKWrC4EPxy4rWXfQ9F-JWz-67VYfKRjS3m7uc8wBQ",
        usedKey: "sha256-LWmgzxnrIhywpNW0mctCFWfh2CptjGJJN_H2_FLN2fg"
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
      })
    );
  });
});
