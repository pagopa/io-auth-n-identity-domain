import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import {
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import {
  CosmosErrorResponse,
  CosmosErrors
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

const COSMOS_ERROR_KIND = "COSMOS_ERROR_RESPONSE";
const CONFLICT_CODE = 409;
function isCosmosError(
  ce: CosmosErrors
): ce is ReturnType<typeof CosmosErrorResponse> {
  return ce.kind === COSMOS_ERROR_KIND;
}

const createServicePreference: (
  preference: NewServicePreference
) => RTE.ReaderTaskEither<Dependencies, Error, boolean> = preference => ({
  servicePreferenceModel
}) =>
  pipe(
    servicePreferenceModel.create(preference),
    TE.fold(
      cosmosError =>
        isCosmosError(cosmosError) && cosmosError.error.code === CONFLICT_CODE
          ? TE.of<Error, boolean>(false)
          : TE.left(
              new Error(
                `Can not create the service preferences: ${JSON.stringify(
                  cosmosError
                )}`
              )
            ),
      _ => TE.of<Error, boolean>(true)
    )
  );

export type Dependencies = {
  servicePreferenceModel: ServicesPreferencesModel;
};

export type ServicePreferencesRepository = typeof repository;

export const repository = { createServicePreference };
