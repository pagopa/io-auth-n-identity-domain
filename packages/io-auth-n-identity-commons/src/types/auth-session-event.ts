import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum EventTypeEunum {
  "LOGIN" = "login",
  "LOGOUT" = "logout",
}

export type EventType = t.TypeOf<typeof EventType>;
export const EventType = enumType<EventTypeEunum>(EventTypeEunum, "EventType");

const BaseAuthSessionEvent = t.type({
  fiscalCode: FiscalCode,
});

//TODO: LoginEvent and LogoutEvent will contain other data,
// currently only the fields needed for user engagement are included,
// under definition what to include in this event for other purposes

export const LoginEvent = t.intersection([
  t.type({
    eventType: t.literal(EventTypeEunum.LOGIN),
    expiredAt: DateFromTimestamp,
  }),
  BaseAuthSessionEvent,
]);
export type LoginEvent = t.TypeOf<typeof LoginEvent>;

export const LogoutEvent = t.intersection([
  t.type({ eventType: t.literal(EventTypeEunum.LOGOUT) }),
  BaseAuthSessionEvent,
]);
export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;

export const AuthSessionEvent = t.union([LoginEvent, LogoutEvent]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
