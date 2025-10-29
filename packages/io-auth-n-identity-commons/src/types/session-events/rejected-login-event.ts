import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import {
  FiscalCode,
  IPString,
  PatternString,
} from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { Sha256HexString } from "../crypto";
import { EventTypeEnum } from "./event-type";

export enum RejectedLoginCauseEnum {
  AGE_BLOCK = "age_block",
  AUTH_LOCK = "auth_lock",
  CF_MISMATCH = "cf_mismatch",
}

export type RejectedLoginCause = t.TypeOf<typeof RejectedLoginCause>;
export const RejectedLoginCause = enumType<RejectedLoginCauseEnum>(
  RejectedLoginCauseEnum,
  "RejectedLoginCause",
);

export const BaseRejectedLoginEventContent = t.type({
  // ServiceBus event type for auth-session-topic
  eventType: t.literal(EventTypeEnum.REJECTED_LOGIN),

  // Fiscal code of the user that attempted to login
  fiscalCode: FiscalCode,

  // Timestamp of the rejected login event
  ts: DateFromTimestamp,

  // Date of the SPID request / response in YYYY-MM-DD format
  createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),

  // IP of the client that made a SPID login action
  ip: t.string.pipe(IPString),

  // XML payload of the SPID Request
  requestPayload: t.string,

  // XML payload of the SPID Response
  responsePayload: t.string,

  // SPID request id
  spidRequestId: t.union([t.undefined, t.string]),
});
export type BaseRejectedLoginEventContent = t.TypeOf<
  typeof BaseRejectedLoginEventContent
>;

export const AgeBlockRejectedLogin = t.intersection([
  t.type({
    rejectionCause: t.literal(RejectedLoginCauseEnum.AGE_BLOCK),
    minimumAge: t.number,
  }),
  BaseRejectedLoginEventContent,
]);
export type AgeBlockRejectedLogin = t.TypeOf<typeof AgeBlockRejectedLogin>;

export const AuthLockRejectedLogin = t.intersection([
  t.type({
    rejectionCause: t.literal(RejectedLoginCauseEnum.AUTH_LOCK),
  }),
  BaseRejectedLoginEventContent,
]);
export type AuthLockRejectedLogin = t.TypeOf<typeof AuthLockRejectedLogin>;

export const UserMismatchRejectedLogin = t.intersection([
  t.type({
    rejectionCause: t.literal(RejectedLoginCauseEnum.CF_MISMATCH),
    // The fiscal code of the currently authenticated user in the app.
    currentFiscalCode: Sha256HexString,
  }),
  BaseRejectedLoginEventContent,
]);
export type UserMismatchRejectedLogin = t.TypeOf<
  typeof UserMismatchRejectedLogin
>;

export const RejectedLoginEvent = t.union([
  AgeBlockRejectedLogin,
  AuthLockRejectedLogin,
  UserMismatchRejectedLogin,
]);
export type RejectedLoginEvent = t.TypeOf<typeof RejectedLoginEvent>;
