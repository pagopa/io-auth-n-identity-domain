import { LogoutEventSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";
import { LoginEventSchema } from "./login-event.vo.js";
import { RejectedLoginEventSchema } from "./rejected-login-event.vo.js";

export const AuthEventSchema = z.union([
  LoginEventSchema,
  LogoutEventSchema,
  RejectedLoginEventSchema,
]);
export type AuthEvent = z.infer<typeof AuthEventSchema>;
