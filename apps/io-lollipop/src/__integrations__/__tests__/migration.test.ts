import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { exit } from "process";
import * as date_fns from "date-fns";

import { CosmosClient } from "@azure/cosmos";
import { BlobServiceClient } from "@azure/storage-blob";

import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";

import {
    WAIT_MS,
    SHOW_LOGS,
    COSMOSDB_URI,
    COSMOSDB_KEY,
    COSMOSDB_NAME,
    BEARER_AUTH_HEADER,
    QueueStorageConnection,
    BASE_URL
} from "../env";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { ActivatePubKeyPayload } from "../../generated/definitions/internal/ActivatePubKeyPayload";
import { AssertionTypeEnum } from "../../generated/definitions/internal/AssertionType";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { LcParams } from "../../generated/definitions/internal/LcParams";

import {
    createCosmosDbAndCollections,
    LOLLIPOP_COSMOSDB_COLLECTION_NAME
} from "../utils/fixtures";
import { createBlobs, deleteBlob } from "../utils/azure_storage";
import {
    fetchGenerateLcParams,
    fetchGetAssertion,
    fetchReservePubKey
} from "../utils/client";

import {aFiscalCode} from "../../__mocks__/lollipopPubKey.mock";
import { generateJwkForTest } from "../utils/jwk";
import { ActivatePubKeyHandler } from "../../ActivatePubKey/handler";
import { getPublicKeyDocumentReader } from "../../utils/readers";
import { getAssertionWriter, getPopDocumentWriter } from "../../utils/writers";
import { LolliPOPKeysModel } from "../../model/lollipop_keys";
import { Context } from "@azure/functions";
import { IResponseErrorForbiddenNotAuthorized, IResponseErrorInternal, IResponseErrorValidation, IResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import { ActivatedPubKey } from "../../generated/definitions/internal/ActivatedPubKey";
import { AssertionRef } from "../../generated/definitions/external/AssertionRef";

const MAX_ATTEMPT = 50;
const TIMEOUT = WAIT_MS * MAX_ATTEMPT;

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

const baseUrl = BASE_URL;
const myFetch = (getNodeFetch(customHeaders) as unknown) as typeof fetch;

const LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME = "lollipop-assertions-01" as NonEmptyString;
const LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONTAINER_NAME = "assertions" as NonEmptyString;
const SOME_OTHER_CONTAINER_NAME = "some-other-container" as NonEmptyString;
const CONTAINERS = [
    LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME,
    LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONTAINER_NAME,
    SOME_OTHER_CONTAINER_NAME
];

// ----------------
// Setup dbs
// ----------------

const blobService = BlobServiceClient.fromConnectionString(QueueStorageConnection);

const cosmosClient = new CosmosClient({
    endpoint: COSMOSDB_URI,
    key: COSMOSDB_KEY
});

// Wait some time
beforeAll(async () => {
    await pipe(
        createCosmosDbAndCollections(COSMOSDB_NAME),
        TE.getOrElse(e => {
            throw Error("Cannot create infra resources: " + JSON.stringify(e));
        })
    )();
    await pipe(
        createBlobs(blobService, CONTAINERS),
        TE.getOrElse(e => {
            throw Error("Cannot create azure storage: " + JSON.stringify(e));
        })
    )();

    await waitFunctionToSetup();
}, TIMEOUT);

beforeEach(() => {
    vi.clearAllMocks();
});

const cosmosInstance = cosmosClient.database(COSMOSDB_NAME);
const container = cosmosInstance.container(LOLLIPOP_COSMOSDB_COLLECTION_NAME);
const lollipopKeysModel = new LolliPOPKeysModel(container);

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
describe("getAssertion |> Success", () => {
    test.each`
    scenario                                                               | containerName     
    ${"SUCCESS in case the assertion is stored in the primary container"}  | ${LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME}
    ${"SUCCESS in case the assertion is stored in the fallback container"} | ${LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONTAINER_NAME} 
  `(
      "$scenario",
      async ({ containerName }) => {
            const lcParams = await setupTestAndGenerateLcParams(
                ActivatePubKeyHandler(
                    getPublicKeyDocumentReader(lollipopKeysModel),
                    getPopDocumentWriter(lollipopKeysModel),
                    getAssertionWriter(
                        blobService,
                        containerName
                    )
                )
            );

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
        }
    );
});

describe("getAssertion |> Failures", () => {
    test.each`
scenario                                                               | containerName | statusCode
    ${"FAILURE in case the assertion is stored on another container"}  | ${SOME_OTHER_CONTAINER_NAME} | ${410}
  `(
        "$scenario",
        async ({ containerName, statusCode }) => {
            const lcParams = await setupTestAndGenerateLcParams(
                ActivatePubKeyHandler(
                    getPublicKeyDocumentReader(lollipopKeysModel),
                    getPopDocumentWriter(lollipopKeysModel),
                    getAssertionWriter(
                        blobService,
                        containerName
                    )
                )
            );

            const response = await fetchGetAssertion(
                lcParams.assertion_ref,
                BEARER_AUTH_HEADER,
                lcParams.lc_authentication_bearer,
                baseUrl,
                myFetch
            );

            expect(response.status).toEqual(statusCode);
        }
    );
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

async function setupTestAndGenerateLcParams(
    activatePubKeyHandler: (
        context: Context,
        assertion_ref: AssertionRef,
        body: ActivatePubKeyPayload
    ) => Promise<
        IResponseSuccessJson<ActivatedPubKey>
        | IResponseErrorValidation
        | IResponseErrorForbiddenNotAuthorized
        | IResponseErrorInternal
    >
) {
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

    const responseActivate = await activatePubKeyHandler(
        {} as unknown as Context,
        randomAssertionRef,
        validActivatePubKeyPayload
    );

    expect(responseActivate.kind).toEqual("IResponseSuccessJson");
    expect((responseActivate as IResponseSuccessJson<ActivatedPubKey>).value).toMatchObject({
        assertion_file_name: `${validActivatePubKeyPayload.fiscal_code}-${randomAssertionRef}`,
        assertion_ref: randomAssertionRef,
        expired_at: validActivatePubKeyPayload.expired_at,
        fiscal_code: validActivatePubKeyPayload.fiscal_code,
        pub_key: Buffer.from(JSON.stringify(randomJwk)).toString("base64url"),
        status: "VALID"
    });

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
