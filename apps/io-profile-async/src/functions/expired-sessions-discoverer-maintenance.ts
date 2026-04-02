import { pipe } from "fp-ts/function";
import * as RTE from "fp-ts/ReaderTaskEither";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";

import { createInterval } from "../types/interval";
import { ExpiredSessionsDiscovererQueueMessage } from "../types/expired-sessions-discoverer-queue-message";
import { QueueTransientError } from "../utils/queue-utils";
import {
  runDiscovery,
  TriggerDependencies,
  trackTransientErrors,
} from "./expired-sessions-discoverer";

export const makeHandler: H.Handler<
  ExpiredSessionsDiscovererQueueMessage,
  void,
  TriggerDependencies
> = H.of(
  ({ date }) =>
    (deps) =>
      pipe(
        runDiscovery(createInterval(date)),
        RTE.mapLeft((errors) => {
          trackTransientErrors(createInterval(date), errors);
          return new QueueTransientError(
            "One or more chunks failed during processing",
          );
        }),
      )(deps),
);

export const ExpiredSessionsDiscovererMaintenanceFunction =
  azureFunction(makeHandler);
