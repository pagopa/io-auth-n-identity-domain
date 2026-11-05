import { z } from "zod";

export const LogoutOutputDTO = z
  .object({
    message: z.literal("ok"),
  })
  .meta({
    id: "SuccessResponse",
    description: "Logout completed successfully.",
  });
export type LogoutOutputDTO = z.infer<typeof LogoutOutputDTO>;
