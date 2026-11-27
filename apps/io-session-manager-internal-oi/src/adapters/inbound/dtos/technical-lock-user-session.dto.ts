import z from "zod";

export const TechnicalLockUserSessionOutputDto = z
  .object({
    message: z.literal("ok"),
  })
  .meta({
    id: "TechnicalLockUserSessionOutputResponse",
    description: "User session lock operation succeeded.",
  });
