import { exit } from "process";

import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import {
  createCosmosDbAndCollections,
  LOLLIPOP_COSMOSDB_COLLECTION_NAME
} from "../utils/fixtures";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";

import {
  WAIT_MS,
  SHOW_LOGS,
  COSMOSDB_URI,
  COSMOSDB_NAME,
  COSMOSDB_KEY
} from "../env";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { LolliPOPKeysModel } from "../../model/lollipop_keys";
import {
  aLolliPopPubKeys,
  anAssertionRef,
  aPendingLolliPopPubKeys
} from "../../__mocks__/lollipopkeysMock";
import * as date_fns from "date-fns";
import * as jwt from "jsonwebtoken";
import { CosmosClient } from "@azure/cosmos";
import { fetchGenerateLcParams } from "../utils/client";

const MAX_ATTEMPT = 50;

jest.setTimeout(WAIT_MS * MAX_ATTEMPT);

const baseUrl = "http://function:7071";
const nodeFetch = (getNodeFetch() as unknown) as typeof fetch;

// ----------------
// Setup dbs
// ----------------

const cosmosClient = new CosmosClient({
  endpoint: COSMOSDB_URI,
  key: COSMOSDB_KEY
});

// Wait some time
beforeAll(async () => {
  await pipe(
    createCosmosDbAndCollections(COSMOSDB_NAME),
    TE.getOrElse(e => {
      throw Error("Cannot create db");
    })
  )();

  await waitFunctionToSetup();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// -------------------------
// Tests
// -------------------------

const cosmosInstance = cosmosClient.database(COSMOSDB_NAME);
const container = cosmosInstance.container(LOLLIPOP_COSMOSDB_COLLECTION_NAME);
const model = new LolliPOPKeysModel(container);

const aGenerateLcParamsPayload = {
  operation_id: "an_operation_id" as NonEmptyString
};

const aSha256AssertionRef =
  "sha256-LWmgzxnrIhywpNW0mctCFWfh2CptjGJJN_H2_FLN2fg";

const aPendingSha256AssertionRef =
  "sha256-LWmgzxnrIhywpNW0mctCFWfh2CptjGJJN_H2_PEND1n";

const aNotExistingSha256AssertionRef =
  "sha256-LWmgzxnrIhywpNW0mctCFWfh2CptjGJJN_H2_FLN1gg";

describe("GenerateLcParams", () => {
  test("GIVEN a new correctly initialized public key WHEN calling generateLcParams THEN return a success containing LcParams", async () => {
    await model.upsert({
      ...aLolliPopPubKeys,
      expiredAt: date_fns.addDays(new Date(), 30)
    })();

    const result = await fetchGenerateLcParams(
      anAssertionRef,
      aGenerateLcParamsPayload,
      baseUrl,
      nodeFetch
    );
    const content = await result.json();
    expect(content).toEqual(
      expect.objectContaining({
        assertion_file_name: aLolliPopPubKeys.assertionFileName,
        assertion_ref: aLolliPopPubKeys.assertionRef,
        assertion_type: aLolliPopPubKeys.assertionType,
        fiscal_code: aLolliPopPubKeys.fiscalCode,
        pub_key: aLolliPopPubKeys.pubKey,
        status: aLolliPopPubKeys.status
      })
    );
    expect(jwt.decode(content.lc_authentication_bearer)).toEqual(
      expect.objectContaining({
        assertionRef: anAssertionRef,
        operationId: aGenerateLcParamsPayload.operation_id
      })
    );
  });

  test("GIVEN a pending public key WHEN calling generateLcParams THEN return Forbidden", async () => {
    await model.create({
      ...aPendingLolliPopPubKeys,
      assertionRef: aPendingSha256AssertionRef as any
    })();

    const result = await fetchGenerateLcParams(
      aPendingSha256AssertionRef,
      aGenerateLcParamsPayload,
      baseUrl,
      nodeFetch
    );
    expect(result.status).toEqual(403);
  });

  test("GIVEN a not existing public key WHEN calling generateLcParams THEN return Not Found", async () => {
    const result = await fetchGenerateLcParams(
      aNotExistingSha256AssertionRef,
      aGenerateLcParamsPayload,
      baseUrl,
      nodeFetch
    );
    expect(result.status).toEqual(404);
  });

  test("GIVEN an expired public key WHEN calling generateLcParams THEN return Forbidden", async () => {
    await model.upsert({
      ...aLolliPopPubKeys,
      assertionRef: aSha256AssertionRef as any,
      expiredAt: date_fns.addDays(new Date(), -1000)
    })();

    const result = await fetchGenerateLcParams(
      aSha256AssertionRef,
      aGenerateLcParamsPayload,
      baseUrl,
      nodeFetch
    );
    expect(result.status).toEqual(403);
  });

  test("GIVEN a malformed payload WHEN calling generateLcParams THEN return a bad request", async () => {
    const result = await fetchGenerateLcParams(
      anAssertionRef,
      {
        wrong: "wrong"
      },
      baseUrl,
      nodeFetch
    );
    expect(result.status).toEqual(400);
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
      await nodeFetch(baseUrl + "/info");
      break;
    } catch (e) {
      log("Waiting the function to setup...|" + JSON.stringify(e));
      await delay(WAIT_MS);
      i++;
    }
  }
  if (i >= MAX_ATTEMPT) {
    log("Function unable to setup in time");
    exit(1);
  }
};
