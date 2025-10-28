import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { LoginEvent } from "./login-event";
import { LogoutEvent } from "./logout-event";
import { RejectedLoginEvent } from "./rejected-login-event";

export enum EventTypeEnum {
  LOGIN = "login",
  LOGOUT = "logout",
  REJECTED_LOGIN = "rejected_login",
}

export type EventType = t.TypeOf<typeof EventType>;
export const EventType = enumType<EventTypeEnum>(EventTypeEnum, "EventType");

export const BaseAuthSessionEvent = t.type({
  fiscalCode: FiscalCode,
  ts: DateFromTimestamp,
});

export const AuthSessionEvent = t.union([
  LoginEvent,
  LogoutEvent,
  RejectedLoginEvent,
]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
