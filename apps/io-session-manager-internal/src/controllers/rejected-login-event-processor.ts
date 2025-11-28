import { RejectedLoginEvent } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";
import {
  RejectedLoginAuditLogService,
  RejectedLoginAuditLogServiceDeps,
} from "../services/rejected-login-audit-log-service";

type FunctionDependencies = {
  rejectedLoginAuditLogService: RejectedLoginAuditLogService;
} & RejectedLoginAuditLogServiceDeps;

export const RejectedLoginEventProcessorHandler: H.Handler<
  RejectedLoginEvent,
  void,
  FunctionDependencies
> = H.of(
  (documents) => (deps) =>
    deps.rejectedLoginAuditLogService.saveRejectedLoginEvent(documents)(deps),
);

export const RejectedLoginEventProcessorFunction = azureFunction(
  RejectedLoginEventProcessorHandler,
);
