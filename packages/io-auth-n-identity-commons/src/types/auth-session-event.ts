import * as t from "io-ts";
import { LoginEvent } from "./login-event";
import { LogoutEvent } from "./logout-event";
import { RejectedLoginEvent } from "./rejected-login-event";

export const AuthSessionEvent = t.union([
  LoginEvent,
  LogoutEvent,
  RejectedLoginEvent,
]);
export type AuthSessionEvent = t.TypeOf<typeof AuthSessionEvent>;
