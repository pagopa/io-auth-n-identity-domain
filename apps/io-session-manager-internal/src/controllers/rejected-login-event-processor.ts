import { RejectedLoginEvent } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";
import {
  RejectedLoginAuditLogService,
  RejectedLoginAuditLogServiceDeps,
} from "../services/rejected-login-audit-log-service";

export type FunctionDependencies = {
  rejectedLoginAuditLogService: RejectedLoginAuditLogService;
} & RejectedLoginAuditLogServiceDeps;

export const RejectedLoginEventProcessorHandler: H.Handler<
  RejectedLoginEvent,
  void,
  FunctionDependencies
> = H.of(
  (document) => (deps) =>
    deps.rejectedLoginAuditLogService.saveRejectedLoginEvent(document)(deps),
);

export const RejectedLoginEventProcessorFunction = azureFunction(
  RejectedLoginEventProcessorHandler,
);
