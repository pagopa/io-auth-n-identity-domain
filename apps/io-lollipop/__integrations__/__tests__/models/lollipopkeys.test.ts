import {
  createContext,
  makeRandomContainerName
} from "../../utils/cosmos_utils";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_MODEL_PK_FIELD,
  TTL_VALUE_AFTER_UPDATE,
  TTL_VALUE_FOR_RESERVATION
} from "../../../model/lollipop_keys";
import {
  aLolliPopPubKeys,
  aPendingLolliPopPubKeys
} from "../../../__mocks__/lollipopkeysMock";
import { CosmosClient } from "@azure/cosmos";
import { COSMOSDB_URI, COSMOSDB_KEY, COSMOSDB_NAME } from "../../env";

const containerName = makeRandomContainerName();

const context = createContext(LOLLIPOPKEYS_MODEL_PK_FIELD, containerName, true);

beforeEach(async () => await context.init());
afterEach(async () => await context.dispose());

describe("Create", () => {
  test("GIVEN a working model and a pending LolliPopPubKeys WHEN create method is called THEN the document should be in the database with ttl equal to 15m", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aPendingLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aPendingLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionRef: aPendingLolliPopPubKeys.assertionRef,
            pubKey: aPendingLolliPopPubKeys.pubKey,
            status: aPendingLolliPopPubKeys.status,
            ttl: TTL_VALUE_FOR_RESERVATION,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and a valid LolliPopPubKeys WHEN create method is called THEN the document should be in the database with ttl equal to 2y", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionFileName: aLolliPopPubKeys.assertionFileName,
            assertionRef: aLolliPopPubKeys.assertionRef,
            assertionType: aLolliPopPubKeys.assertionType,
            fiscalCode: aLolliPopPubKeys.fiscalCode,
            pubKey: aLolliPopPubKeys.pubKey,
            status: aLolliPopPubKeys.status,
            ttl: TTL_VALUE_AFTER_UPDATE,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and 2 same documents WHEN create is called the second time THEN a COSMOS_CONFLICT_RESPONSE should be returned", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aLolliPopPubKeys)();
    const r = await model.create(aLolliPopPubKeys)();
    expect(r).toEqual(
      expect.objectContaining({
        _tag: "Left",
        left: { kind: "COSMOS_CONFLICT_RESPONSE" }
      })
    );
  });
});

describe("Upsert", () => {
  test("GIVEN a working model and a pending LolliPopPubKeys WHEN upsert method is called THEN the document should be in the database with ttl equal to 15m", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.upsert(aPendingLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aPendingLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionRef: aPendingLolliPopPubKeys.assertionRef,
            pubKey: aPendingLolliPopPubKeys.pubKey,
            status: aPendingLolliPopPubKeys.status,
            ttl: TTL_VALUE_FOR_RESERVATION,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and a valid LolliPopPubKeys WHEN upsert method is called THEN the document should be in the database with ttl equal to 2y", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.upsert(aLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionFileName: aLolliPopPubKeys.assertionFileName,
            assertionRef: aLolliPopPubKeys.assertionRef,
            assertionType: aLolliPopPubKeys.assertionType,
            fiscalCode: aLolliPopPubKeys.fiscalCode,
            pubKey: aLolliPopPubKeys.pubKey,
            status: aLolliPopPubKeys.status,
            ttl: TTL_VALUE_AFTER_UPDATE,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and a valid LolliPopKeys WHEN upsert method is called and a document with same assertionRef is inside database THEN it should create a new version with ttl to 2y", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aPendingLolliPopPubKeys)();
    await model.upsert(aLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionFileName: aLolliPopPubKeys.assertionFileName,
            assertionRef: aLolliPopPubKeys.assertionRef,
            assertionType: aLolliPopPubKeys.assertionType,
            fiscalCode: aLolliPopPubKeys.fiscalCode,
            pubKey: aLolliPopPubKeys.pubKey,
            status: aLolliPopPubKeys.status,
            ttl: TTL_VALUE_AFTER_UPDATE,
            version: 1
          })
        })
      })
    );
  });

  test("GIVEN a working model WHEN a document in the database has only the version 1 and the create method is called on it THEN it should return an error", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aPendingLolliPopPubKeys)();
    await model.upsert(aLolliPopPubKeys)();

    const client = new CosmosClient({
      endpoint: COSMOSDB_URI,
      key: COSMOSDB_KEY
    });

    //we delete the version 0 of the document but no the version 1
    await client
      .database(COSMOSDB_NAME)
      .container(containerName)
      .item(
        `${aLolliPopPubKeys.assertionRef}-0000000000000000`,
        aLolliPopPubKeys.assertionRef
      )
      .delete();
    const r = await model.create(aPendingLolliPopPubKeys)();

    expect(r).toEqual(
      expect.objectContaining({
        _tag: "Left",
        left: { kind: "COSMOS_CONFLICT_RESPONSE" }
      })
    );
  });
});
