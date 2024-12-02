import { AzureFunction, Context } from "@azure/functions";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME
} from "../model/lollipop_keys";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { Failure } from "../utils/errors";
import { MASTER_HASH_ALGO } from "../utils/lollipopKeys";
import { handleRevoke } from "./handler";

const config = getConfigOrThrow();

const lollipopKeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(LOLLIPOPKEYS_COLLECTION_NAME)
);

const telemetryClient = initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

export const index: AzureFunction = (
  context: Context,
  rawRevokeMessage: unknown
): Promise<Failure | void> =>
  handleRevoke(
    context,
    telemetryClient,
    lollipopKeysModel,
    MASTER_HASH_ALGO,
    rawRevokeMessage
  );

export default index;
