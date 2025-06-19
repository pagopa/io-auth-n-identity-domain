import * as O from "fp-ts/Option";
import { getRequiredENVVar } from "../utils/environment";

export const SERVICE_BUS_NAMESPACE = getRequiredENVVar("SERVICE_BUS_NAMESPACE");

export const AUTH_SESSIONS_TOPIC_NAME = getRequiredENVVar(
  "AUTH_SESSIONS_TOPIC_NAME",
);

export const DEV_SERVICE_BUS_CONNECTION_STRING = O.fromNullable(
  process.env.DEV_SERVICE_BUS_CONNECTION_STRING,
);
