import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum EventTypeEnum {
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
}

export type EventType = t.TypeOf<typeof EventType>;
export const EventType = enumType<EventTypeEnum>(EventTypeEnum, "EventType");

const BaseAuthSessionEvent = t.type({
  fiscalCode: FiscalCode,
  ts: DateFromTimestamp,
});

// TODO: LoginEvent and LogoutEvent will contain other data,
// currently only the fields needed for user engagement are included,
// under definition what to include in this event for other purposes

export const LoginEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.LOGIN),
    expiredAt: DateFromTimestamp,
    loginType: t.union([t.literal("LEGACY"), t.literal("LV")]),
    scenario: t.union([
      t.literal("NEW_USER"),
      t.literal("STANDARD"),
      t.literal("RELOGIN"),
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
      t.literal("APP"),
      t.literal("WEB"),
      t.literal("AUTH_LOCK"),
      t.literal("ACCOUNT_REMOVAL"),
    ]),
  }),
  BaseAuthSessionEvent,
]);
export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;

export const AuthSessionEvent = t.union([LoginEvent, LogoutEvent]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
