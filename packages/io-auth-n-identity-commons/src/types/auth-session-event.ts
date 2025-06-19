import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum EventTypeEnum {
  LOGIN = "login",
  LOGOUT = "logout",
}

export type EventType = t.TypeOf<typeof EventType>;
export const EventType = enumType<EventTypeEnum>(EventTypeEnum, "EventType");

const BaseAuthSessionEvent = t.type({
  fiscalCode: FiscalCode,
  ts: DateFromTimestamp,
});

export enum LoginTypeEnum {
  LEGACY = "legacy",
  LV = "lv",
}

export type LoginType = t.TypeOf<typeof LoginType>;
export const LoginType = enumType<LoginTypeEnum>(LoginTypeEnum, "LoginType");

export enum LoginScenarioEnum {
  NEW_USER = "new_user",
  STANDARD = "standard",
  RELOGIN = "relogin",
}

export type LoginScenario = t.TypeOf<typeof LoginScenario>;
export const LoginScenario = enumType<LoginScenarioEnum>(
  LoginScenarioEnum,
  "LoginScenario",
);

export const LoginEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.LOGIN),
    expiredAt: DateFromTimestamp,
    loginType: LoginType,
    scenario: LoginScenario,
    idp: t.string,
  }),
  BaseAuthSessionEvent,
]);
export type LoginEvent = t.TypeOf<typeof LoginEvent>;

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

export const AuthSessionEvent = t.union([LoginEvent, LogoutEvent]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
