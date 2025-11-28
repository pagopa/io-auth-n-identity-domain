/* eslint-disable @typescript-eslint/no-unused-vars */

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockBlobUtils } from "../../__mocks__/blob-utils.mock";
import {
  aFiscalCodeHash,
  anAgeBlockRejectedLoginEvent,
  anAuthLockRejectedLoginEvent,
  anEventWithoutLoginId,
  anOngoingUserDeletionRejectedLoginEvent,
  anUserMismatchRejectedLoginEvent,
} from "../../__mocks__/service-bus-events.mocks";
import { AuditLogConfig } from "../../utils/config";
import {
  RejectedLoginAuditLogService,
  RejectedLoginAuditLogServiceDeps,
} from "../rejected-login-audit-log-service";
import { mockRejectedLoginAuditLogRepository } from "../../__mocks__/repositories/rejected-login-audit-log.mock";

// Mock randomBytes to return a fixed value for deterministic tests
const fixedRandomBytesPaddingString = "aabbcc";
vi.mock("crypto", () => ({
  randomBytes: vi.fn(() => Buffer.from(fixedRandomBytesPaddingString, "hex")),
}));

// Dependency Mocks
const mockAuditLogConfig = {
  AUDIT_LOG_STORAGE_CONNECTION_STRING: "aConnectionString",
  AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME: "aContainerName",
} as unknown as AuditLogConfig;

const deps = {
  blobUtil: mockBlobUtils,
  auditLogConfig: mockAuditLogConfig,
  auditBlobServiceClient: {}, // no need to mock the full client for these tests
  rejectedLoginAuditLogRepository: mockRejectedLoginAuditLogRepository,
} as unknown as RejectedLoginAuditLogServiceDeps;

describe("RejectedLoginAuditLog service saveRejectedLoginEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    EventDescription                                | eventData
    ${"UserMismatch Rejected Login Event"}          | ${anUserMismatchRejectedLoginEvent}
    ${"Age Block Rejected Login Event"}             | ${anAgeBlockRejectedLoginEvent}
    ${"Auth Lock Rejected Login Event"}             | ${anAuthLockRejectedLoginEvent}
    ${"Ongoing User Deletion Rejected Login Event"} | ${anOngoingUserDeletionRejectedLoginEvent}
    ${"Event lacking of loginId"}                   | ${anEventWithoutLoginId}
  `(
    `should process and write an $EventDescription to the audit log blob container successfully`,
    async ({ eventData }) => {
      // Expected Values
      const expectedBlobName = `${aFiscalCodeHash}-${eventData.rejectionCause}-${eventData.ts.toISOString()}-${fixedRandomBytesPaddingString}`;
      const expectedBlobTags = {
        dateTime: eventData.ts.toISOString(),
        fiscalCode: aFiscalCodeHash,
        ip: eventData.ip,
        rejectionCause: eventData.rejectionCause,
        loginId: eventData.loginId,
        currentFiscalCodeHash: eventData.currentFiscalCodeHash,
      };

      const result =
        await RejectedLoginAuditLogService.saveRejectedLoginEvent(eventData)(
          deps,
        )();

      expect(
        mockRejectedLoginAuditLogRepository.saveAuditLog,
      ).toHaveBeenCalledExactlyOnceWith(
        expectedBlobName,
        eventData,
        expectedBlobTags,
      );

      expect(result).toEqual(E.right(void 0));
    },
  );

  it("should return an error if the blob upsert fails", async () => {
    const blobError = new Error("Blob upsert failed");

    // Expected Values
    const expectedBlobName = `${aFiscalCodeHash}-${anUserMismatchRejectedLoginEvent.rejectionCause}-${anUserMismatchRejectedLoginEvent.ts.toISOString()}-${fixedRandomBytesPaddingString}`;
    const expectedBlobTags = {
      dateTime: anUserMismatchRejectedLoginEvent.ts.toISOString(),
      fiscalCode: aFiscalCodeHash,
      ip: anUserMismatchRejectedLoginEvent.ip,
      rejectionCause: anUserMismatchRejectedLoginEvent.rejectionCause,
      loginId: anUserMismatchRejectedLoginEvent.loginId,
      currentFiscalCodeHash:
        anUserMismatchRejectedLoginEvent.currentFiscalCodeHash,
    };

    mockRejectedLoginAuditLogRepository.saveAuditLog.mockReturnValueOnce(() =>
      TE.left(blobError),
    );

    const result = await RejectedLoginAuditLogService.saveRejectedLoginEvent(
      anUserMismatchRejectedLoginEvent,
    )(deps)();

    expect(
      mockRejectedLoginAuditLogRepository.saveAuditLog,
    ).toHaveBeenCalledExactlyOnceWith(
      expectedBlobName,
      anUserMismatchRejectedLoginEvent,
      expectedBlobTags,
    );

    expect(result).toEqual(E.left(blobError));
  });
});
