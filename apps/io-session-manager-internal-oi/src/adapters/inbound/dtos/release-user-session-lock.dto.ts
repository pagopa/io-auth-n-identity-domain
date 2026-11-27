import { UnlockCodeSchema } from "@pagopa/io-session-manager-core";
import z from "zod";

export const ReleaseUserSessionLockInputDto = z
  .object({
    unlock_code: UnlockCodeSchema.optional(),
  })
  .meta({
    id: "ReleaseUserSessionLockInput",
    description:
      "Unlock code of the lock to release. When omitted, all the open locks are released.",
  });
