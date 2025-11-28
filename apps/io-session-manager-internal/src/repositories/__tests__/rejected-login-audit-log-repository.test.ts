/* eslint-disable @typescript-eslint/no-unused-vars */

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockBlobUtils } from "../../__mocks__/blob-utils.mock";
import { anUserMismatchRejectedLoginEvent } from "../../__mocks__/service-bus-events.mocks";
import { AuditLogConfig } from "../../utils/config";
import {
  RejectedLoginAuditLogRepository,
  RejectedLoginAuditLogRepositoryDeps,
} from "../rejected-login-audit-log-repository";

// Dependency Mocks
const mockAuditLogConfig = {
  AUDIT_LOG_STORAGE_CONNECTION_STRING: "aConnectionString",
  AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME: "aContainerName",
} as unknown as AuditLogConfig;

const deps = {
  blobUtil: mockBlobUtils,
  auditLogConfig: mockAuditLogConfig,
  auditBlobServiceClient: {}, // no need to mock the full client for these tests
} as unknown as RejectedLoginAuditLogRepositoryDeps;

describe("RejectedLoginAuditLog repository saveAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const someValidTags = {
    aTag: "aValue",
    anotherTag: "anotherValue",
  };
  const aFileName = "aFileName";

  it("should return an error if the blob upsert fails", async () => {
    // Expected Values

    const result = await RejectedLoginAuditLogRepository.saveAuditLog(
      aFileName,
      anUserMismatchRejectedLoginEvent,
      someValidTags,
    )(deps)();

    expect(mockBlobUtils.upsertBlobFromText).toHaveBeenCalledExactlyOnceWith(
      deps.auditBlobServiceClient,
      deps.auditLogConfig.AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME,
      aFileName,
      JSON.stringify(anUserMismatchRejectedLoginEvent),
      { tags: someValidTags },
    );

    expect(result).toEqual(E.right(void 0));
  });

  it("should return an error if the blob upsert fails", async () => {
    // Arrange
    const blobError = new Error("Blob upsert failed");

    mockBlobUtils.upsertBlobFromText.mockReturnValueOnce(TE.left(blobError));

    const result = await RejectedLoginAuditLogRepository.saveAuditLog(
      aFileName,
      anUserMismatchRejectedLoginEvent,
      someValidTags,
    )(deps)();

    expect(mockBlobUtils.upsertBlobFromText).toHaveBeenCalledExactlyOnceWith(
      deps.auditBlobServiceClient,
      deps.auditLogConfig.AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME,
      aFileName,
      JSON.stringify(anUserMismatchRejectedLoginEvent),
      { tags: someValidTags },
    );

    expect(result).toEqual(E.left(blobError));
  });
});
