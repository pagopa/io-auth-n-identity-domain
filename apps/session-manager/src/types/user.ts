import * as t from "io-ts";
import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { SpidLevel } from "./spid-level";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "./token";

// required attributes
export const UserWithoutTokens = t.intersection([
  t.interface({
    created_at: t.number,
    // date_of_birth become required with https://github.com/pagopa/io-backend/pull/831.
    // We assume that all valid sessions have now the date_of_birth parameter
    date_of_birth: t.string,
    family_name: t.string,
    fiscal_code: FiscalCode,
    name: t.string,
    spid_level: SpidLevel,
  }),
  t.partial({
    nameID: t.string,
    nameIDFormat: t.string,
    sessionIndex: t.string,
    session_tracking_id: t.string, // unique ID used for tracking in appinsights
    spid_email: EmailString,
    spid_idp: t.string,
  }),
]);
export type UserWithoutTokens = t.TypeOf<typeof UserWithoutTokens>;

const RequiredUserTokensV1 = t.interface({
  session_token: SessionToken,
  wallet_token: WalletToken,
});
export const UserV1 = t.intersection([UserWithoutTokens, RequiredUserTokensV1]);
export type UserV1 = t.TypeOf<typeof UserV1>;

const RequiredUserTokensV2 = t.intersection([
  RequiredUserTokensV1,
  t.interface({
    myportal_token: MyPortalToken,
  }),
]);
export const UserV2 = t.intersection([UserWithoutTokens, RequiredUserTokensV2]);
export type UserV2 = t.TypeOf<typeof UserV2>;

const RequiredUserTokensV3 = t.intersection([
  RequiredUserTokensV2,
  t.interface({
    bpd_token: BPDToken,
  }),
]);
export const UserV3 = t.intersection([UserWithoutTokens, RequiredUserTokensV3]);
export type UserV3 = t.TypeOf<typeof UserV3>;

const RequiredUserTokensV4 = t.intersection([
  RequiredUserTokensV3,
  t.interface({
    zendesk_token: ZendeskToken,
  }),
]);
export const UserV4 = t.intersection([UserWithoutTokens, RequiredUserTokensV4]);
export type UserV4 = t.TypeOf<typeof UserV4>;

const RequiredUserTokensV5 = t.intersection([
  RequiredUserTokensV4,
  t.interface({
    fims_token: FIMSToken,
  }),
]);
export const UserV5 = t.intersection([UserWithoutTokens, RequiredUserTokensV5]);
export type UserV5 = t.TypeOf<typeof UserV5>;

export const User = t.union([UserV1, UserV2, UserV3, UserV4, UserV5], "User");
export type User = t.TypeOf<typeof User>;
