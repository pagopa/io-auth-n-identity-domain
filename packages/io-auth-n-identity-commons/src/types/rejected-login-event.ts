import { IPString, PatternString } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { BaseAuthSessionEvent, EventTypeEnum } from "./auth-session-event";

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

// TODO: Provisional fields (fiscalCode and ts already in the base event)
export const BaseRejectedLoginEventContent = t.intersection([
  t.type({
    // ServiceBus event type for auth-session-topic
    eventType: t.literal(EventTypeEnum.REJECTED_LOGIN),
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
  }),
  BaseAuthSessionEvent,
]);
export type BaseRejectedLoginEventContent = t.TypeOf<
  typeof BaseRejectedLoginEventContent
>;

export const AgeBlockRejectedLogin = t.intersection([
  t.type({
    rejectionCause: t.literal(RejectedLoginCauseEnum.AGE_BLOCK),
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
    currentFiscalCode: t.string, // TODO: move from session manager the Sha256HexString io-ts type in this lib
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
