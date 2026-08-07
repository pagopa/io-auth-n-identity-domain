import { z } from "zod";

/**
 * Login configuration schema.
 * `LOGIN_SUCCESS_REDIRECT_URL` is the base URL the callback endpoint redirects
 * the user-agent to once the session has been activated. The freshly minted
 * client session token is appended to it.
 * `LOGIN_ERROR_REDIRECT_URL` is the base URL the callback endpoint redirects
 * the user-agent to when the login fails. The error code (and optional message)
 * is appended to it as query parameters.
 */
export const LoginConfigSchema = z.object({
  LOGIN_SUCCESS_REDIRECT_URL: z.url(),
  LOGIN_ERROR_REDIRECT_URL: z.url(),
});

export type LoginConfig = z.infer<typeof LoginConfigSchema>;
