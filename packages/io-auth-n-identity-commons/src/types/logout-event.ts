import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { BaseAuthSessionEvent, EventTypeEnum } from "./auth-session-event";
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

export const LogoutEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.LOGOUT),
    scenario: LogoutScenario,
  }),
  BaseAuthSessionEvent,
]);

export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;
