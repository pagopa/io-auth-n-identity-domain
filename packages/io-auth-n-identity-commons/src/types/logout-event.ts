import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
export enum LogoutScenarioEnum {
  APP = "app",
  WEB = "web",
  AUTH_LOCK = "auth_lock",
  ACCOUNT_REMOVAL = "account_removal",
}

export type LogoutScenario = t.TypeOf<typeof LogoutScenario>;
export const LogoutScenario = enumType<LogoutScenarioEnum>(
  LogoutScenarioEnum,
  "LogoutScenario",
);

export const LogoutEventContent = t.type({
  scenario: LogoutScenario,
});

export type LogoutEventContent = t.TypeOf<typeof LogoutEventContent>;
