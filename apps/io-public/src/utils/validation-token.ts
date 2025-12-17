import * as crypto from "crypto";

import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import { TableClient } from "@azure/data-tables";
import { ValidationTokenEntityAzureDataTables } from "@pagopa/io-functions-commons/dist/src/entities/validation_token";
import { retrieveTableEntityDecoded, StorageError } from "./azure_storage";
import { TokenParam } from "./middleware";

export const retrieveValidationTokenEntity = (
  tableClient: TableClient,
  token: TokenParam
): TE.TaskEither<
  Error | StorageError,
  O.Option<ValidationTokenEntityAzureDataTables>
> => {
  // A token is in the following format:
  // [tokenId ULID] + ":" + [validatorHash crypto.randomBytes(12)]
  // Split the token to get tokenId and validatorHash
  const [tokenId, validator] = token.split(":");
  const validatorHash = crypto
    .createHash("sha256")
    .update(validator)
    .digest("hex");

  // Retrieve the entity from the table storage
  return retrieveTableEntityDecoded(
    tableClient,
    tokenId,
    validatorHash,
    ValidationTokenEntityAzureDataTables
  );
};
