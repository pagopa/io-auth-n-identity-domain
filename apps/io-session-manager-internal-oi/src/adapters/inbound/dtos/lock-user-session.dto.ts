import { UnlockCodeSchema } from "@pagopa/io-session-manager-core";
import z from "zod";

export const LockUserSessionInputDto = z
  .object({
    unlock_code: UnlockCodeSchema,
  })
  .meta({
    id: "LockUserSessionInput",
    description: "Unlock code required to release the user-set lock.",
  });
