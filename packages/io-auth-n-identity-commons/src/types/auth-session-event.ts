import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { LoginEventContent } from "./login-event";
import { LogoutEventContent } from "./logout-event";
import { RejectedLoginEventContent } from "./rejected-login-event";

export enum EventTypeEnum {
  LOGIN = "login",
  LOGOUT = "logout",
  REJECTED_LOGIN = "rejected_login",
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
  }),
  LoginEventContent,
  BaseAuthSessionEvent,
]);
export type LoginEvent = t.TypeOf<typeof LoginEvent>;

export const LogoutEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.LOGOUT),
  }),
  LogoutEventContent,
  BaseAuthSessionEvent,
]);
export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;

export const RejectedLoginEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEnum.REJECTED_LOGIN),
  }),
  RejectedLoginEventContent,
  BaseAuthSessionEvent,
]);
export type RejectedLoginEvent = t.TypeOf<typeof RejectedLoginEvent>;

export const AuthSessionEvent = t.union([
  LoginEvent,
  LogoutEvent,
  RejectedLoginEvent,
]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
