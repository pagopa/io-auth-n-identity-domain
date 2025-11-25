import { randomBytes } from "crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import {
  RejectedLoginCauseEnum,
  RejectedLoginEvent,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { BlobUtil } from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import * as RTE from "fp-ts/ReaderTaskEither";
import { AuditLogConfig } from "../utils/config";

export type RejectedLoginAuditLogServiceDeps = {
  auditBlobServiceClient: BlobServiceClient;
  auditLogConfig: AuditLogConfig;
  blobUtil: BlobUtil;
};

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
  return `${fiscalCodeSha256}-${EventUTCDateTime}-${rejectionCause}-${randomBytesPart}`;
};

// Removing eventType as not required in the audit log
const generateBlobContent = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eventType,
  ...auditContent
}: RejectedLoginEvent): string => JSON.stringify(auditContent);

const generateBlobTags = (eventData: RejectedLoginEvent) => {
  const baseTags = {
    dateTime: eventData.ts.toISOString(),
    fiscalCode: sha256(eventData.fiscalCode),
    ip: eventData.ip,
    rejectionCause: eventData.rejectionCause,
    ...(eventData.loginId ? { loginId: eventData.loginId } : {}),
  };

  // Specific tags for events, in future if we need to add more cases we can switch to a full switch statement
  if (eventData.rejectionCause === RejectedLoginCauseEnum.CF_MISMATCH) {
    return {
      ...baseTags,
      currentFiscalCodeHash: eventData.currentFiscalCodeHash,
    };
  } else {
    return baseTags;
  }
};

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
    deps.blobUtil.upsertBlobFromText(
      deps.auditBlobServiceClient,
      deps.auditLogConfig.AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME,
      generateBlobName(rejectedLoginEvent),
      generateBlobContent(rejectedLoginEvent),
      {
        tags: generateBlobTags(rejectedLoginEvent),
      },
    );
export type RejectedLoginAuditLogService = typeof RejectedLoginAuditLogService;
export const RejectedLoginAuditLogService = {
  saveRejectedLoginEvent,
};
