import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { EventTypeEnum } from "./event-type";
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

export const LogoutEvent = t.type({
  eventType: t.literal(EventTypeEnum.LOGOUT),
  fiscalCode: FiscalCode,
  ts: DateFromTimestamp,
  scenario: LogoutScenario,
});

export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;
