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

export const LoginEvent = t.intersection([
  t.type({
    expiredAt: DateFromTimestamp,
  }),
  t.type({ eventType: t.literal(EventTypeEunum.LOGIN) }),
  BaseAuthSessionEvent,
]);
export type LoginEvent = t.TypeOf<typeof LoginEvent>;

//TODO: this will contain more data, under definition what to include in this event
export const LogoutEvent = t.intersection([
  t.type({ eventType: t.literal(EventTypeEunum.LOGOUT) }),
  BaseAuthSessionEvent,
]);
export type LogoutEvent = t.TypeOf<typeof LogoutEvent>;

export const AuthSessionEvent = t.union([LoginEvent, LogoutEvent]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
