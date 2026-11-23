import z from "zod";

export const TechnicalLockUserSessionOutputDto = z
  .object({
    message: z.literal("ok"),
  })
  .meta({
    id: "TechnicalLockUserSessionOutputResponse",
    description: "User session lock operation succeeded.",
  });

export const TechnicalUnlockUserSessionOutputDto = z
  .object({
    message: z.literal("ok"),
  })
  .meta({
    id: "TechnicalUnlockUserSessionOutputResponse",
    description: "User session unlock operation succeeded.",
  });
