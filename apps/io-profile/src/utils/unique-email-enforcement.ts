import { TableClient } from "@azure/data-tables";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export const getProfileEmailTableClient = (
  connectionString: NonEmptyString,
  tableName: NonEmptyString,
) => TableClient.fromConnectionString(connectionString, tableName);
