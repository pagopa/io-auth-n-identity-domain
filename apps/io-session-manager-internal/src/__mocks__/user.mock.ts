import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { OutputOf } from "io-ts";
import { AssertionRefSha256 } from "../generated/definitions/internal/AssertionRefSha256";
import { UnlockCode } from "../generated/definitions/internal/UnlockCode";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "../types/token";
import { SpidLevelEnum } from "../types/spid-level";
import { User } from "../types/user";
import { SessionState } from "../generated/definitions/internal/SessionState";
import { TypeEnum } from "../generated/definitions/internal/SessionInfo";

export const aFiscalCode = "SPNDNL80R13C555X" as FiscalCode;
export const anEmailAddress = "garibaldi@example.com" as EmailString;
export const aValidSpidLevel = SpidLevelEnum["https://www.spid.gov.it/SpidL2"];

export const anAssertionRef =
  "sha256-6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=" as AssertionRefSha256;

export const anUnlockCode = "123456789" as UnlockCode;
export const anotherUnlockCode = "987654321" as UnlockCode;

export const mockSessionToken =
  "c77de47586c841adbd1a1caeb90dce25dcecebed620488a4f932a6280b10ee99a77b6c494a8a6e6884ccbeb6d3fe736b" as SessionToken;
export const mockWalletToken =
  "5ba5b99a982da1aa5eb4fd8643124474fa17ee3016c13c617ab79d2e7c8624bb80105c0c0cae9864e035a0d31a715043" as WalletToken;
export const mockMyPortalToken =
  "c4d6bc16ef30211fb3fa8855efecac21be04a7d032f8700dc4d6bc16ef30211fb3fa8855efecac21be04a7d032f8700d" as MyPortalToken;
export const mockBPDToken =
  "4123ee213b64955212ea59e3beeaad1e5fdb3a36d22104164123ee213b64955212ea59e3beeaad1e5fdb3a36d2210416" as BPDToken;
export const mockZendeskToken =
  "aaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210abcaaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210abc" as ZendeskToken;
export const mockFIMSToken =
  "aaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210bcdaaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210bcd" as FIMSToken;

export const anUser: User = {
  bpd_token: mockBPDToken,
  created_at: 1183518855,
  date_of_birth: "2002-01-01",
  family_name: "Garibaldi",
  fims_token: mockFIMSToken,
  fiscal_code: aFiscalCode,
  myportal_token: mockMyPortalToken,
  name: "Giuseppe Maria",
  session_token: mockSessionToken,
  spid_email: anEmailAddress,
  spid_level: aValidSpidLevel,
  wallet_token: mockWalletToken,
  zendesk_token: mockZendeskToken,
};

export const anUnlockedUserSessionState: OutputOf<typeof SessionState> = {
  access_enabled: true,
  session_info: {
    active: true,
    expiration_date: "2025-05-01T00:00:00.000Z",
    type: TypeEnum.LV,
  },
};
