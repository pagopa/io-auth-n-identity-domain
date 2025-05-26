import {
  HealthCheck,
  HealthProblem,
  toHealthProblems
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";

import { sequenceT } from "fp-ts/lib/Apply";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { CosmosDBDependency } from "./dependency";

export type AzureCosmosProblemSource =
  | "CosmosApiAzureCosmosDB"
  | "CitizenAuthAzureCosmosDB";

const applicativeValidation = TE.getApplicativeTaskValidation(
  T.ApplicativePar,
  RA.getSemigroup<HealthProblem<AzureCosmosProblemSource>>()
);

export const makeAzureCosmosDbHealthCheck = ({
  cosmosApiDb,
  citizenAuthDb
}: CosmosDBDependency): HealthCheck<AzureCosmosProblemSource> =>
  pipe(
    sequenceT(applicativeValidation)(
      TE.tryCatch(
        () => cosmosApiDb.client.getDatabaseAccount(),
        toHealthProblems("CosmosApiAzureCosmosDB" as AzureCosmosProblemSource)
      ),
      TE.tryCatch(
        () => citizenAuthDb.client.getDatabaseAccount(),
        toHealthProblems("CitizenAuthAzureCosmosDB" as AzureCosmosProblemSource)
      )
    ),
    TE.map(() => true)
  );
