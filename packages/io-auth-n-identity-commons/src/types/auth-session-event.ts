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

export const LoginEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.LOGIN),
    expiredAt: DateFromTimestamp,
    loginType: t.union([t.literal("legacy"), t.literal("lv")]),
    scenario: t.union([
      t.literal("new_user"),
      t.literal("standard"),
      t.literal("relogin"),
    ]),
    idp: t.string,
  }),
  BaseAuthSessionEvent,
]);
export type LoginEvent = t.TypeOf<typeof LoginEvent>;

export const LogoutEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.LOGOUT),
    scenario: t.union([
      t.literal("app"),
      t.literal("web"),
      t.literal("auth_lock"),
      t.literal("account_removal"),
    ]),
  }),
  BaseAuthSessionEvent,
]);
export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;

export const AuthSessionEvent = t.union([LoginEvent, LogoutEvent]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
