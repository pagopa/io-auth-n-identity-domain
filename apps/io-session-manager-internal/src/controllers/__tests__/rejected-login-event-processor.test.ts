/* eslint-disable @typescript-eslint/no-unused-vars */

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { RejectedLoginEvent } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { mockBlobUtils } from "../../__mocks__/blob-utils.mock";
import { anAuthLockRejectedLoginEvent } from "../../__mocks__/service-bus-events.mocks";
import { AuditLogConfig } from "../../utils/config";

import { ValidationError } from "@pagopa/handler-kit";
import { mockRejectedLoginAuditLogRepository } from "../../__mocks__/repositories/rejected-login-audit-log.mock";
import { mockRejectedLoginAuditLogService } from "../../__mocks__/services/rejected-login-audit-log-service.mock";
import { mockServiceBusHandlerInputMocks } from "../__mocks__/handler.mock";
import {
  FunctionDependencies,
  RejectedLoginEventProcessorHandler,
} from "../rejected-login-event-processor";

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
  rejectedLoginAuditLogService: mockRejectedLoginAuditLogService,
} as unknown as FunctionDependencies;

describe("RejectedLoginEventProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should process a valid Rejected Login Event", async () => {
    const res = await RejectedLoginEventProcessorHandler({
      ...deps,
      ...mockServiceBusHandlerInputMocks(
        RejectedLoginEvent,
        anAuthLockRejectedLoginEvent,
      ),
    })();

    expect(
      mockRejectedLoginAuditLogService.saveRejectedLoginEvent,
    ).toHaveBeenCalledExactlyOnceWith(anAuthLockRejectedLoginEvent);

    expect(res).toEqual(E.right(void 0));
  });

  it("should fail on error from service", async () => {
    const anError = new Error("An error occurred");
    mockRejectedLoginAuditLogService.saveRejectedLoginEvent.mockReturnValueOnce(
      () => TE.left(anError),
    );

    const res = await RejectedLoginEventProcessorHandler({
      ...deps,
      ...mockServiceBusHandlerInputMocks(
        RejectedLoginEvent,
        anAuthLockRejectedLoginEvent,
      ),
    })();

    expect(
      mockRejectedLoginAuditLogService.saveRejectedLoginEvent,
    ).toHaveBeenCalledExactlyOnceWith(anAuthLockRejectedLoginEvent);

    expect(res).toEqual(E.left(anError));
  });

  it("should fail on invalid Rejected Login Event", async () => {
    const aBadEventFormat = {
      badProperty: "badValue",
    };

    const res = await RejectedLoginEventProcessorHandler({
      ...deps,
      ...mockServiceBusHandlerInputMocks(RejectedLoginEvent, aBadEventFormat),
    })();

    expect(
      mockRejectedLoginAuditLogService.saveRejectedLoginEvent,
    ).not.toHaveBeenCalled();

    expect(res).toEqual(E.left(new ValidationError([expect.any(String)])));
  });
});
