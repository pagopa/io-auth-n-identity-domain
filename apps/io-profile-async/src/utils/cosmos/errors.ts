import {
  CosmosErrors,
  CosmosResource
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/lib/Option";
import * as t from "io-ts";

export const cosmosErrorsToString = (errs: CosmosErrors): NonEmptyString =>
  pipe(
    errs.kind === "COSMOS_EMPTY_RESPONSE"
      ? "Empty response"
      : errs.kind === "COSMOS_DECODING_ERROR"
      ? "Decoding error: " + errorsToReadableMessages(errs.error).join("/")
      : errs.kind === "COSMOS_CONFLICT_RESPONSE"
      ? "Conflict error"
      : "Generic error: " + JSON.stringify(errs.error),

    errorString => errorString as NonEmptyString
  );

export const getSelfFromModelValidationError = (validationErrors: t.Errors) =>
  pipe(
    O.tryCatch(() => validationErrors[0].context[0].actual),
    O.fold(
      () => "N/A",
      actual => pipe(CosmosResource.is(actual) ? actual._self : "N/A")
    )
  );
