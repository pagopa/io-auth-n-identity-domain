import {
  TableClient,
  type TableServiceClientOptions,
} from "@azure/data-tables";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export const getProfileEmailTableClient = (
  connectionString: NonEmptyString,
  tableName: NonEmptyString,
  options?: TableServiceClientOptions,
) => TableClient.fromConnectionString(connectionString, tableName, options);
