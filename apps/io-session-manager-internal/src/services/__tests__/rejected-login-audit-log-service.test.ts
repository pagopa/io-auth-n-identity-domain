/* eslint-disable @typescript-eslint/no-unused-vars */

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockBlobUtils } from "../../__mocks__/repositories/blob-utils.mock";
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
} as unknown as RejectedLoginAuditLogServiceDeps;

describe("RejectedLoginAuditLog service getPackageInfo", () => {
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
      const { eventType, ...auditLogContent } = eventData;

      // Expected Values
      const expectedBlobContent = JSON.stringify(auditLogContent);
      const expectedBlobName = `${aFiscalCodeHash}-${eventData.ts.toISOString()}-${eventData.rejectionCause}-${fixedRandomBytesPaddingString}`;
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

      expect(mockBlobUtils.upsertBlobFromText).toHaveBeenCalledExactlyOnceWith(
        deps.auditBlobServiceClient,
        mockAuditLogConfig.AUDIT_LOG_REJECTED_LOGIN_CONTAINER_NAME,
        expectedBlobName,
        expectedBlobContent,
        {
          tags: expectedBlobTags,
        },
      );

      expect(result).toEqual(E.right(void 0));
    },
  );

  it("should return an error if the blob upsert fails", async () => {
    // Arrange
    const blobError = new Error("Blob upsert failed");

    mockBlobUtils.upsertBlobFromText.mockReturnValueOnce(TE.left(blobError));

    const result = await RejectedLoginAuditLogService.saveRejectedLoginEvent(
      anUserMismatchRejectedLoginEvent,
    )(deps)();

    expect(result).toEqual(E.left(blobError));
  });
});
