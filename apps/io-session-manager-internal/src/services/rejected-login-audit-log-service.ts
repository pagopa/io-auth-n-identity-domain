import { randomBytes } from "crypto";
import {
  RejectedLoginCauseEnum,
  RejectedLoginEvent,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import * as RTE from "fp-ts/ReaderTaskEither";
import {
  RejectedLoginAuditLogRepository,
  RejectedLoginAuditLogRepositoryDeps,
} from "../repositories/rejected-login-audit-log-repository";

export type RejectedLoginAuditLogServiceDeps = {
  rejectedLoginAuditLogRepository: RejectedLoginAuditLogRepository;
} & RejectedLoginAuditLogRepositoryDeps;

/**
 * File name pattern "${hash(CF)}-${RejectedLogin}-${EventUTCDateTime}-${randomBytes(3)}".
 *
 * @param rejectedLoginEvent Rejected Log-In event
 * @returns Rejected login audit Log blob name
 */

const generateBlobName = ({
  fiscalCode,
  rejectionCause,
  ts,
}: RejectedLoginEvent): string => {
  const EventUTCDateTime = ts.toISOString();
  const randomBytesPart = randomBytes(3).toString("hex");
  const fiscalCodeSha256 = sha256(fiscalCode);
  return `${fiscalCodeSha256}-${rejectionCause}-${EventUTCDateTime}-${randomBytesPart}`;
};

/**
 * Generates blob tags for the rejected login event.
 * @param eventData The rejected login event data
 * @returns A record of blob tags key-value pairs [ dateTime, fiscalCode, ip, rejectionCause, loginId?, currentFiscalCodeHash? ]
 */
const generateBlobTags = (
  eventData: RejectedLoginEvent,
): Record<string, string> => ({
  dateTime: eventData.ts.toISOString(),
  fiscalCode: sha256(eventData.fiscalCode),
  ip: eventData.ip,
  rejectionCause: eventData.rejectionCause,
  ...(eventData.loginId ? { loginId: eventData.loginId } : {}),
  ...(eventData.rejectionCause === RejectedLoginCauseEnum.CF_MISMATCH
    ? { currentFiscalCodeHash: eventData.currentFiscalCodeHash }
    : {}),
});

/**
 * Saves a rejected login event to the audit log blob storage.
 *
 * @param rejectedLoginEvent The rejected login event to save
 * @returns A ReaderTaskEither that resolves to void on success or an Error on failure
 */
const saveRejectedLoginEvent: (
  rejectedLoginEvent: RejectedLoginEvent,
) => RTE.ReaderTaskEither<RejectedLoginAuditLogServiceDeps, Error, void> =
  (rejectedLoginEvent) => (deps) =>
    deps.rejectedLoginAuditLogRepository.saveAuditLog(
      generateBlobName(rejectedLoginEvent),
      rejectedLoginEvent,
      generateBlobTags(rejectedLoginEvent),
    )(deps);
export type RejectedLoginAuditLogService = typeof RejectedLoginAuditLogService;
export const RejectedLoginAuditLogService = {
  saveRejectedLoginEvent,
};
