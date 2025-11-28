import { BlobServiceClient } from "@azure/storage-blob";
import { RejectedLoginEvent } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { BlobUtil } from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
import * as RTE from "fp-ts/ReaderTaskEither";
import { AuditLogConfig } from "../utils/config";

export type RejectedLoginAuditLogRepositoryDeps = {
  auditBlobServiceClient: BlobServiceClient;
  auditLogConfig: AuditLogConfig;
  blobUtil: BlobUtil;
};

/**
 * Saves a rejected login event to the audit log blob storage.
 *
 * @param name The name of the rejected login event to save in blob storage
 * @param content The rejected login event content to save in blob storage
 * @param tags The rejected login event tags to save in blob storage
 * @returns A ReaderTaskEither that resolves to void on success or an Error on failure
 */
const saveAuditLog: (
  name: string,
  content: RejectedLoginEvent,
  tags: Record<string, string>,
) => RTE.ReaderTaskEither<RejectedLoginAuditLogRepositoryDeps, Error, void> =
  (name, content, tags) => (deps) =>
    deps.blobUtil.upsertBlobFromText(
      deps.auditBlobServiceClient,
      deps.auditLogConfig.AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME,
      name,
      JSON.stringify(content),
      {
        tags,
      },
    );
export type RejectedLoginAuditLogRepository =
  typeof RejectedLoginAuditLogRepository;
export const RejectedLoginAuditLogRepository = {
  saveAuditLog,
};
