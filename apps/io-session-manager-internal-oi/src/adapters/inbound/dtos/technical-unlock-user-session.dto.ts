import z from "zod";

export const TechnicalUnlockUserSessionOutputDto = z
  .object({
    message: z.literal("ok"),
  })
  .meta({
    id: "TechnicalUnlockUserSessionOutputResponse",
    description: "User session unlock operation succeeded.",
  });
