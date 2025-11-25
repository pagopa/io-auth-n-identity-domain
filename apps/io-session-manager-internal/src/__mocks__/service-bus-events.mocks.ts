/* eslint-disable @typescript-eslint/no-unused-vars */
import { UserMismatchRejectedLogin } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";

export const aFiscalCode = "AAAAAA89S20I111X";
export const aFiscalCodeHash =
  "1d3dfa703368078fc62dbfaba2c6d5f83069258ef0bbfc1ebe992e97f4274ded"; // sha256 of "AAAAAA89S20I111X"
export const aDifferentFiscalCodeHash =
  "438cb21f4edc118a51ae28dc4125f4cf59c29e252f30e4e77746b24c6d39fae6"; // sha256 of "BBBBBB89S20I111Y"

// Rejected Login Events Mocks
const aBaseRejectedLoginServiceBusEvent = {
  eventType: "rejected_login",
  createdAtDay: "2023-08-15",
  ip: "127.0.0.1",
  loginId: "request-id-123",
  fiscalCode: aFiscalCode,
  ts: new Date(),
};

export const anUserMismatchRejectedLoginEvent = {
  rejectionCause: "cf_mismatch",
  currentFiscalCodeHash: aDifferentFiscalCodeHash,
  ...aBaseRejectedLoginServiceBusEvent,
} as unknown as UserMismatchRejectedLogin;

export const anAgeBlockRejectedLoginEvent = {
  rejectionCause: "age_block",
  minimumAge: 18,
  dateOfBirth: "2008-05-20",
  ...aBaseRejectedLoginServiceBusEvent,
} as unknown as UserMismatchRejectedLogin;

export const anAuthLockRejectedLoginEvent = {
  rejectionCause: "auth_lock",
  ...aBaseRejectedLoginServiceBusEvent,
} as unknown as UserMismatchRejectedLogin;

export const anOngoingUserDeletionRejectedLoginEvent = {
  rejectionCause: "ongoing_user_deletion",
  ...aBaseRejectedLoginServiceBusEvent,
} as unknown as UserMismatchRejectedLogin;

const { loginId, ...withoutLoginId } = anOngoingUserDeletionRejectedLoginEvent;
export const anEventWithoutLoginId = withoutLoginId;
