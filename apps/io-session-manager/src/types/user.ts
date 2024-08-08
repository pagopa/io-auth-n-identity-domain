import * as t from "io-ts";
import {
  EmailString,
  FiscalCode,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { Issuer } from "@pagopa/io-spid-commons/dist/config";
import { ALLOWED_TEST_ISSUER } from "../config/spid";
import { EmailAddress } from "../generated/backend/EmailAddress";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "./token";
import { SpidLevel } from "./spid-level";

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

const RequiredUserTokens = t.interface({
  session_token: SessionToken,
  wallet_token: WalletToken,
  myportal_token: MyPortalToken,
  bpd_token: BPDToken,
  zendesk_token: ZendeskToken,
  fims_token: FIMSToken,
});

export const User = t.intersection([UserWithoutTokens, RequiredUserTokens]);
export type User = t.TypeOf<typeof User>;

// required attributes
export const SpidUser = t.intersection([
  t.interface({
    authnContextClassRef: SpidLevel,
    dateOfBirth: t.string,
    familyName: t.string,
    fiscalNumber: FiscalCode,
    getAcsOriginalRequest: t.Function,
    getAssertionXml: t.Function,
    getSamlResponseXml: t.Function,
    // The allowed issuer must include development Issuer
    // and Spid SAML Check even in production if provided in config.
    issuer: ALLOWED_TEST_ISSUER ? NonEmptyString : Issuer,
    name: t.string,
  }),
  t.partial({
    email: EmailAddress,
    nameID: t.string,
    nameIDFormat: t.string,
    sessionIndex: t.string,
  }),
]);

export type SpidUser = t.TypeOf<typeof SpidUser>;

export const SpidObject = t.intersection([
  t.interface({
    fiscalNumber: t.string,
    getAcsOriginalRequest: t.Function,
    getAssertionXml: t.Function,
    getSamlResponseXml: t.Function,
  }),
  t.partial({
    authnContextClassRef: t.any,
    issuer: t.any,
  }),
]);
