import { z } from "zod";

export const PubKeyStatusSchema = z.enum(["PENDING", "VALID", "REVOKED"]);
export type PubKeyStatusSchema = z.infer<typeof PubKeyStatusSchema>;
