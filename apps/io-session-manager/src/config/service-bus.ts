import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import {
  FeatureFlag,
  FeatureFlagEnum,
} from "@pagopa/ts-commons/lib/featureFlag";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { flow, pipe } from "fp-ts/lib/function";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { getRequiredENVVar } from "../utils/environment";
import { getIsUserEligibleForServiceBusEvents } from "../utils/service-bus";

export const SERVICE_BUS_NAMESPACE = getRequiredENVVar("SERVICE_BUS_NAMESPACE");

export const AUTH_SESSIONS_TOPIC_NAME = getRequiredENVVar(
  "AUTH_SESSIONS_TOPIC_NAME",
);

export const DEV_SERVICE_BUS_CONNECTION_STRING = O.fromNullable(
  process.env.DEV_SERVICE_BUS_CONNECTION_STRING,
);

export const FF_SERVICE_BUS_EVENTS = pipe(
  process.env.FF_SERVICE_BUS_EVENTS,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const SERVICE_BUS_EVENTS_USERS = pipe(
  process.env.SERVICE_BUS_EVENTS_USERS,
  O.fromNullable,
  O.map(
    flow(
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(
          `Invalid SERVICE_BUS_EVENTS_USERS value: ${readableReport(err)}`,
        );
      }),
    ),
  ),
  O.getOrElseW(() => []),
);

export const isUserEligibleForServiceBusEvents =
  getIsUserEligibleForServiceBusEvents(
    SERVICE_BUS_EVENTS_USERS,
    FF_SERVICE_BUS_EVENTS,
  );
