import { z } from "zod";
import { LoginEventSchema } from "./login-event.vo.js";
import { LogoutEventSchema } from "./logout-event.vo.js";
import { RejectedLoginEventSchema } from "./rejected-login-event.vo.js";

export const AuthEventSchema = z.discriminatedUnion("eventType", [
  LoginEventSchema,
  LogoutEventSchema,
  RejectedLoginEventSchema,
]);
export type AuthEvent = z.infer<typeof AuthEventSchema>;
