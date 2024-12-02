import { exit } from "process";

import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";

import {
  createCosmosDbAndCollections,
  LOLLIPOP_COSMOSDB_COLLECTION_NAME
} from "../utils/fixtures";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";
import {
  LolliPOPKeysModel,
  NewLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE,
  TTL_VALUE_FOR_RESERVATION
} from "../../model/lollipop_keys";

import {
  WAIT_MS,
  SHOW_LOGS,
  COSMOSDB_URI,
  COSMOSDB_NAME,
  COSMOSDB_KEY
} from "../env";
import { QueueStorageConnection } from "../env";
import { createBlobs } from "../utils/azure_storage";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import {
  aFiscalCode,
  aValidSha256AssertionRef,
  toEncodedJwk
} from "../../__mocks__/lollipopPubKey.mock";
import { getBlobAsTextWithError } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { ActivatePubKeyPayload } from "../../generated/definitions/internal/ActivatePubKeyPayload";
import { AssertionTypeEnum } from "../../generated/definitions/internal/AssertionType";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { fetchActivatePubKey, fetchReservePubKey } from "../utils/client";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { MASTER_HASH_ALGO } from "../../utils/lollipopKeys";
import { createBlobService } from "azure-storage";
import { AssertionFileName } from "../../generated/definitions/internal/AssertionFileName";
import { CosmosClient } from "@azure/cosmos";
import { generateAssertionRefForTest, generateJwkForTest } from "../utils/jwk";

const MAX_ATTEMPT = 50;

jest.setTimeout(WAIT_MS * MAX_ATTEMPT);

const baseUrl = "http://function:7071";
const myFetch = getNodeFetch();

const LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME = "assertions";

// ----------------
// Setup dbs
// ----------------

const blobService = createBlobService(QueueStorageConnection);

const cosmosClient = new CosmosClient({
  endpoint: COSMOSDB_URI,
  key: COSMOSDB_KEY
});

// Wait some time
beforeAll(async () => {
  await pipe(
    createCosmosDbAndCollections(COSMOSDB_NAME),
    TE.getOrElse(() => {
      throw Error("Cannot create infra resources");
    })
  )();
  await pipe(
    createBlobs(blobService, [LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME]),
    TE.getOrElse(() => {
      throw Error("Cannot create azure storage");
    })
  )();

  await waitFunctionToSetup();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const cosmosInstance = cosmosClient.database(COSMOSDB_NAME);
const container = cosmosInstance.container(LOLLIPOP_COSMOSDB_COLLECTION_NAME);
const lolliPOPKeysModel = new LolliPOPKeysModel(container);

const expires = new Date();

const validActivatePubKeyPayload: ActivatePubKeyPayload = {
  assertion_type: AssertionTypeEnum.SAML,
  assertion: "aValidAssertion" as NonEmptyString,
  expired_at: expires,
  fiscal_code: aFiscalCode
};

// -------------------------
// Tests
// -------------------------

describe("activatePubKey |> Validation Failures", () => {
  it("should fail when an invalid assertionRef is passed to the endpoint", async () => {
    const anInvalidAssertionRef = `anInvalidAssertionRef`;

    const response = await fetchActivatePubKey(
      anInvalidAssertionRef,
      validActivatePubKeyPayload,
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(response.status).toEqual(400);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 400,
      title: "Invalid AssertionRef"
    });
  });

  it("should fail when an invalid payload is passed to the endpoint", async () => {
    const response = await fetchActivatePubKey(
      aValidSha256AssertionRef,
      { ...validActivatePubKeyPayload, fiscal_code: "anInvalidFiscalCode" },
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(response.status).toEqual(400);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 400,
      title: "Invalid ActivatePubKeyPayload"
    });
  });
});

describe("activatePubKey |> Failures", () => {
  it("should return 500 Error when document cannot be found in cosmos", async () => {
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

    const response = await fetchActivatePubKey(
      randomAssertionRef,
      validActivatePubKeyPayload,
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(response.status).toEqual(500);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 500,
      title: "Internal server error",
      detail: "Error while reading pop document: NotFound"
    });
  });

  it("should return 403 when the retrieved pop document has status DIFFERENT FROM PENDING", async () => {
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);
    const randomAssertionFileName = `${aFiscalCode}-${randomAssertionRef}` as AssertionFileName;

    const randomNewPopDocument: NewLolliPopPubKeys = {
      pubKey: toEncodedJwk(randomJwk),
      ttl: TTL_VALUE_FOR_RESERVATION,
      assertionRef: randomAssertionRef,
      status: PubKeyStatusEnum.REVOKED,
      assertionFileName: randomAssertionFileName,
      assertionType: AssertionTypeEnum.SAML,
      fiscalCode: aFiscalCode,
      expiredAt: expires
    };
    const randomActivatePubKeyPayload: ActivatePubKeyPayload = {
      fiscal_code: aFiscalCode,
      assertion: "aValidAssertion" as NonEmptyString,
      assertion_type: AssertionTypeEnum.SAML,
      expired_at: expires
    };

    const res = await lolliPOPKeysModel.create(randomNewPopDocument)();

    expect(E.isRight(res)).toBeTruthy();

    const response = await fetchActivatePubKey(
      randomAssertionRef,
      randomActivatePubKeyPayload,
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(response.status).toEqual(403);
  });
});

describe("activatePubKey |> Success Results", () => {
  it("should succeed when valid payload is passed to the endpoint AND when algo DIFFERS FROM master", async () => {
    const randomJwk = await generateJwkForTest();
    const reserveResult = await fetchReservePubKey(
      { pub_key: randomJwk, algo: JwkPubKeyHashAlgorithmEnum.sha256 },
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(reserveResult.status).toEqual(201);
    const resultBody = await reserveResult.json();

    const anAssertionFileNameForSha256 = `${aFiscalCode}-${resultBody.assertion_ref}`;

    const response = await fetchActivatePubKey(
      resultBody.assertion_ref,
      validActivatePubKeyPayload,
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(response.status).toEqual(200);
    const body = await response.json();
    expect(body).toMatchObject({
      fiscal_code: validActivatePubKeyPayload.fiscal_code,
      expired_at: validActivatePubKeyPayload.expired_at.toISOString(),
      assertion_type: validActivatePubKeyPayload.assertion_type,
      assertion_ref: resultBody.assertion_ref,
      assertion_file_name: anAssertionFileNameForSha256,
      pub_key: toEncodedJwk(randomJwk),
      status: PubKeyStatusEnum.VALID,
      ttl: TTL_VALUE_AFTER_UPDATE,
      version: 1
    });

    // Check values on storages

    const assertionBlob = await pipe(
      getBlobAsTextWithError(
        blobService,
        LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME
      )(anAssertionFileNameForSha256)
    )();

    expect(assertionBlob).toEqual(
      E.right(O.some(validActivatePubKeyPayload.assertion))
    );

    // Check used key
    const sha256Document = await lolliPOPKeysModel.findLastVersionByModelId([
      resultBody.assertion_ref
    ])();

    expect(sha256Document).toEqual(
      E.right(
        O.some(
          expect.objectContaining({
            assertionRef: resultBody.assertion_ref,
            assertionFileName: anAssertionFileNameForSha256,
            status: PubKeyStatusEnum.VALID
          })
        )
      )
    );

    // Check master document
    const masterAssertionRef = await generateAssertionRefForTest(
      randomJwk,
      MASTER_HASH_ALGO
    );
    const masterDocument = await lolliPOPKeysModel.findLastVersionByModelId([
      masterAssertionRef
    ])();

    expect(masterDocument).toEqual(
      E.right(
        O.some(
          expect.objectContaining({
            assertionRef: masterAssertionRef,
            assertionFileName: anAssertionFileNameForSha256,
            status: PubKeyStatusEnum.VALID,
            version: 1
          })
        )
      )
    );
  });

  it("should succeed when valid payload is passed to the endpoint AND when algo EQUALS TO master", async () => {
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(
      randomJwk,
      MASTER_HASH_ALGO
    );
    const randomAssertionFileName = `${validActivatePubKeyPayload.fiscal_code}-${randomAssertionRef}`;

    const resolveResult = await fetchReservePubKey(
      {
        pub_key: randomJwk,
        algo: MASTER_HASH_ALGO
      },
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    const resultBody = await resolveResult.json();

    const response = await fetchActivatePubKey(
      resultBody.assertion_ref,
      validActivatePubKeyPayload,
      baseUrl,
      (myFetch as unknown) as typeof fetch
    );

    expect(response.status).toEqual(200);
    const body = await response.json();
    expect(body).toMatchObject({
      fiscal_code: validActivatePubKeyPayload.fiscal_code,
      expired_at: validActivatePubKeyPayload.expired_at.toISOString(),
      assertion_type: validActivatePubKeyPayload.assertion_type,
      assertion_ref: resultBody.assertion_ref,
      assertion_file_name: randomAssertionFileName,
      pub_key: toEncodedJwk(randomJwk),
      status: PubKeyStatusEnum.VALID,
      ttl: TTL_VALUE_AFTER_UPDATE,
      version: 1
    });

    // Check values on storages

    const assertionBlob = await pipe(
      getBlobAsTextWithError(
        blobService,
        LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME
      )(randomAssertionFileName)
    )();

    expect(assertionBlob).toEqual(
      E.right(O.some(validActivatePubKeyPayload.assertion))
    );

    // Check master document(the only one present)
    const masterDocument = await lolliPOPKeysModel.findLastVersionByModelId([
      randomAssertionRef
    ])();

    expect(masterDocument).toEqual(
      E.right(
        O.some(
          expect.objectContaining({
            assertionRef: randomAssertionRef,
            assertionFileName: randomAssertionFileName,
            status: PubKeyStatusEnum.VALID,
            version: 1
          })
        )
      )
    );
  });
});

// -----------------------
// utils
// -----------------------

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const waitFunctionToSetup = async (): Promise<void> => {
  log("ENV: ", COSMOSDB_URI, WAIT_MS, SHOW_LOGS);
  // eslint-disable-next-line functional/no-let
  let i = 0;
  while (i < MAX_ATTEMPT) {
    log("Waiting the function to setup..");
    try {
      await myFetch(baseUrl + "/info");
      break;
    } catch (e) {
      log("Waiting the function to setup..");
      await delay(WAIT_MS);
      i++;
    }
  }
  if (i >= MAX_ATTEMPT) {
    log("Function unable to setup in time");
    exit(1);
  }
};
