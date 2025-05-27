import { Client } from "../../generated/definitions/sm-internal/client";

export type SessionStateDependency = LogoutDependencies;
export type LockSessionDependency = LogoutDependencies;
export type UnlockSessionDependency = LogoutDependencies;

export type LogoutDependencies = {
  readonly sessionManagerInternalClient: Client<"ApiKeyAuth">;
};
