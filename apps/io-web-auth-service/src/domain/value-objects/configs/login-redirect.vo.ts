import { z } from "zod";

export const LoginRedirectConfigSchema = z.object({
  LOGIN_SUCCESS_REDIRECT_URL: z.url(),
  LOGIN_ERROR_REDIRECT_URL: z.url(),
});
