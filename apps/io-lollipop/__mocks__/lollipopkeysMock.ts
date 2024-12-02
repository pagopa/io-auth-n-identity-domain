import { Container } from "@azure/cosmos";
import { AssertionRef } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionRef";
import { AssertionTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { CosmosResource } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  PendingLolliPopPubKeys,
  RetrievedLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE,
  TTL_VALUE_FOR_RESERVATION,
  NotPendingLolliPopPubKeys
} from "../model/lollipop_keys";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";

export const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
export const anAssertionRef = "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c" as AssertionRef;
export const anAssertionFileName = `${aFiscalCode}-${anAssertionRef}` as AssertionFileName;
export const aPubKey = "aValidPubKey" as NonEmptyString;

export const aCosmosResourceMetadata: Omit<CosmosResource, "id"> = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

export const aPendingLolliPopPubKeys: PendingLolliPopPubKeys = {
  assertionRef: anAssertionRef,
  pubKey: aPubKey,
  status: PubKeyStatusEnum.PENDING
};

export const aLolliPopPubKeys: NotPendingLolliPopPubKeys = {
  assertionFileName: anAssertionFileName,
  assertionRef: anAssertionRef,
  assertionType: AssertionTypeEnum.OIDC,
  expiredAt: new Date(),
  fiscalCode: aFiscalCode,
  pubKey: aPubKey,
  status: PubKeyStatusEnum.VALID
};

export const aRetrievedLolliPopPubKeys: RetrievedLolliPopPubKeys = {
  id: `${aLolliPopPubKeys.assertionRef}-${"0".repeat(16)}` as NonEmptyString,
  ...aCosmosResourceMetadata,
  ...aLolliPopPubKeys,
  ttl: TTL_VALUE_AFTER_UPDATE, // 2y
  version: 0 as NonNegativeInteger
};

export const mockContainer = () => {
  const create = jest.fn().mockImplementation(() =>
    Promise.resolve({
      resource: { ...aRetrievedLolliPopPubKeys, ttl: TTL_VALUE_FOR_RESERVATION }
    })
  );
  const fetchAll = jest.fn().mockImplementation(async () => ({
    resources: []
  }));
  const upsert = jest.fn().mockImplementation(() =>
    Promise.resolve({
      resource: aRetrievedLolliPopPubKeys
    })
  );

  return {
    mock: { create, fetchAll, upsert },
    container: ({
      items: {
        create,
        query: jest.fn(() => ({
          fetchAll
        })),
        upsert
      }
    } as unknown) as Container
  };
};
