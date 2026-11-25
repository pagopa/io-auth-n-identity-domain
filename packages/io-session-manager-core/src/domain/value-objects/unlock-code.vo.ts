import { z } from "zod";

/**
 * Exactly 9 characters long string of digits.
 */
export const UnlockCodeSchema = z.string().length(9).regex(/^\d+$/);

export type UnlockCode = z.infer<typeof UnlockCodeSchema>;
