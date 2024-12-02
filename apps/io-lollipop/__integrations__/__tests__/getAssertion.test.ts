import { exit } from "process";
import * as date_fns from "date-fns";
import * as jwt from "jsonwebtoken";

import { CosmosClient } from "@azure/cosmos";
import { createBlobService, ServiceResponse } from "azure-storage";

import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";

import {
  WAIT_MS,
  ISSUER,
  SHOW_LOGS,
  COSMOSDB_URI,
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  BEARER_AUTH_HEADER,
  QueueStorageConnection,
  A_WRONG_PRIVATE_KEY
} from "../env";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ProblemJson } from "@pagopa/ts-commons/lib/responses";

import { ActivatePubKeyPayload } from "../../generated/definitions/internal/ActivatePubKeyPayload";
import { AssertionTypeEnum } from "../../generated/definitions/internal/AssertionType";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { LcParams } from "../../generated/definitions/internal/LcParams";

import {
  createCosmosDbAndCollections,
  LOLLIPOP_COSMOSDB_COLLECTION_NAME
} from "../utils/fixtures";
import { createBlobs } from "../utils/azure_storage";
import {
  fetchActivatePubKey,
  fetchGenerateLcParams,
  fetchGetAssertion,
  fetchReservePubKey
} from "../utils/client";

import {
  aFiscalCode,
  aValidSha256AssertionRef,
  aValidSha512AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";
import { generateAssertionRefForTest, generateJwkForTest } from "../utils/jwk";
import { ulid } from "ulid";

const MAX_ATTEMPT = 50;

jest.setTimeout(WAIT_MS * MAX_ATTEMPT);

const customHeaders = {
  "x-user-groups": "ApiLollipopAssertionRead",
  "x-subscription-id": "anEnabledServiceId",
  "x-user-email": "unused@example.com",
  "x-user-id": "unused",
  "x-user-note": "unused",
  "x-functions-key": "unused",
  "x-forwarded-for": "0.0.0.0",
  "Ocp-Apim-Subscription-Key": "aSubscriptionKey"
};

const baseUrl = "http://function:7071";
const myFetch = (getNodeFetch(customHeaders) as unknown) as typeof fetch;

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
const lolliPopContainer = cosmosInstance.container(
  LOLLIPOP_COSMOSDB_COLLECTION_NAME
);

const aGenerateLcParamsPayload = {
  operation_id: "an_operation_id" as NonEmptyString
};

const expires = date_fns.addDays(new Date(), 30);

const validActivatePubKeyPayload: ActivatePubKeyPayload = {
  assertion_type: AssertionTypeEnum.SAML,
  assertion: "aValidAssertion" as NonEmptyString,
  expired_at: expires,
  fiscal_code: aFiscalCode
};

// -------------------------
// Tests
// -------------------------

describe("getAssertion |> Validation Failures", () => {
  it("should fail when the required permissions are not met", async () => {
    const myFetchWithoutHeaders = (getNodeFetch() as unknown) as typeof fetch;

    const response = await fetchGetAssertion(
      aValidSha256AssertionRef,
      BEARER_AUTH_HEADER,
      "",
      baseUrl,
      myFetchWithoutHeaders
    );

    expect(response.status).toEqual(403);
    const problemJson = (await response.json()) as ProblemJson;
    expect(problemJson).toMatchObject({
      detail:
        "The request could not be associated to a user, missing userId or subscriptionId.",
      title: "Anonymous user",
      status: 403
    });
  });

  it("should fail when an invalid assertionRef is passed to the endpoint", async () => {
    const anInvalidAssertionRef = "anInvalidAssertionRef";

    const response = await fetchGetAssertion(
      anInvalidAssertionRef,
      BEARER_AUTH_HEADER,
      "",
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(400);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 400,
      title: "Invalid AssertionRef"
    });
  });

  it("should fail when the jwt is not passed to the endpoint", async () => {
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

    const response = await fetchGetAssertion(
      randomAssertionRef,
      BEARER_AUTH_HEADER,
      undefined,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      detail: `Invalid or missing JWT in header ${BEARER_AUTH_HEADER}`,
      title: "You are not allowed here"
    });
  });

  it("should fail when an empty jwt is passed to the endpoint", async () => {
    const anInvalidJwt = "";
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

    const response = await fetchGetAssertion(
      randomAssertionRef,
      BEARER_AUTH_HEADER,
      anInvalidJwt,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      detail: `Invalid or missing JWT in header ${BEARER_AUTH_HEADER}`,
      title: "You are not allowed here"
    });
  });

  it("should fail when an invalid jwt is passed to the endpoint", async () => {
    const anInvalidJwt = "anInvalidJwt";
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

    const response = await fetchGetAssertion(
      randomAssertionRef,
      BEARER_AUTH_HEADER,
      anInvalidJwt,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      detail: `Invalid or expired JWT`,
      title: "You are not allowed here"
    });
  });

  it("should fail when an valid jwt signed with a wrong private key is passed to the endpoint", async () => {
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

    const jwtWithWrongKey = await pipe(
      TE.taskify<Error, string>(cb =>
        jwt.sign(
          {
            operation_id: aGenerateLcParamsPayload.operation_id,
            assertion_ref: randomAssertionRef
          },
          A_WRONG_PRIVATE_KEY,
          {
            algorithm: "RS256",
            expiresIn: `900 seconds`,
            issuer: ISSUER,
            jwtid: ulid()
          },
          cb
        )
      )(),
      TE.getOrElse(() => {
        throw new Error("Unable to create jwt");
      })
    )();

    const response = await fetchGetAssertion(
      randomAssertionRef,
      BEARER_AUTH_HEADER,
      jwtWithWrongKey,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      detail: `Invalid or expired JWT`,
      title: "You are not allowed here"
    });
  });

  it("should fail when the assertionRef in the endpoint does not match the one in the jwt", async () => {
    const lcParams = await setupTestAndGenerateLcParams();

    const anotherAssertionRef = aValidSha512AssertionRef;

    const response = await fetchGetAssertion(
      anotherAssertionRef,
      BEARER_AUTH_HEADER,
      lcParams.lc_authentication_bearer,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      title: "You are not allowed here",
      detail: `You do not have enough permission to complete the operation you requested`
    });
  });

  it("should fail when the document cannot be found in Cosmos", async () => {
    const lcParams = await setupTestAndGenerateLcParams();

    // Recreate the DB to clean-up data
    await pipe(
      createCosmosDbAndCollections(COSMOSDB_NAME),
      TE.getOrElse(() => {
        throw Error("Cannot create infra resources");
      })
    )();

    const response = await fetchGetAssertion(
      lcParams.assertion_ref,
      BEARER_AUTH_HEADER,
      lcParams.lc_authentication_bearer,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(410);
    const body = await response.json();
    expect(body).toMatchObject({
      detail: "Resource gone"
    });
  });

  it("should fail when the assertion cannot be found in Blob Storage", async () => {
    const lcParams = await setupTestAndGenerateLcParams();

    // Delete Blob to let retrieve fail later in the flow
    const deleted = await TE.taskify<Error, ServiceResponse>(cb =>
      blobService.deleteBlob(
        LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME,
        lcParams.assertion_file_name,
        cb
      )
    )()();

    expect(E.isRight(deleted)).toBeTruthy();

    const response = await fetchGetAssertion(
      lcParams.assertion_ref,
      BEARER_AUTH_HEADER,
      lcParams.lc_authentication_bearer,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(410);
    const body = await response.json();
    expect(body).toMatchObject({
      detail: "Resource gone"
    });
  });

  it("should fail when the jwt has expired", async () => {
    const lcParams = await setupTestAndGenerateLcParams();

    await delay(5500);

    const response = await fetchGetAssertion(
      lcParams.assertion_ref,
      BEARER_AUTH_HEADER,
      lcParams.lc_authentication_bearer,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      title: "You are not allowed here",
      detail: `Invalid or expired JWT`
    });
  });
});

describe("getAssertion |> Success", () => {
  it("should succeed when all requirements are met", async () => {
    const lcParams = await setupTestAndGenerateLcParams();

    const response = await fetchGetAssertion(
      lcParams.assertion_ref,
      BEARER_AUTH_HEADER,
      lcParams.lc_authentication_bearer,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(200);
    const body = await response.json();
    expect(body).toMatchObject({
      response_xml: validActivatePubKeyPayload.assertion
    });
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

async function setupTestAndGenerateLcParams() {
  const randomJwk = await generateJwkForTest();

  const reserveResult = await fetchReservePubKey(
    {
      pub_key: randomJwk,
      algo: JwkPubKeyHashAlgorithmEnum.sha256
    },
    baseUrl,
    myFetch
  );

  expect(reserveResult.status).toEqual(201);

  const randomAssertionRef = (await reserveResult.json()).assertion_ref;

  const responseActivate = await fetchActivatePubKey(
    randomAssertionRef,
    validActivatePubKeyPayload,
    baseUrl,
    (myFetch as unknown) as typeof fetch
  );

  expect(responseActivate.status).toEqual(200);

  const resultGenerateLcParams = await fetchGenerateLcParams(
    randomAssertionRef,
    aGenerateLcParamsPayload,
    baseUrl,
    myFetch
  );

  expect(resultGenerateLcParams.status).toEqual(200);
  const generateBody = (await resultGenerateLcParams.json()) as LcParams;
  return generateBody;
}
