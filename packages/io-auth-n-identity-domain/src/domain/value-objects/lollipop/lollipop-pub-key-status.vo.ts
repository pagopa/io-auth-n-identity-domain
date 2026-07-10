import { z } from "zod";

export enum PubKeyStatusEnum {
  "PENDING" = "PENDING",
  "VALID" = "VALID",
  "REVOKED" = "REVOKED",
}
export const PubKeyStatusSchema = z.enum(PubKeyStatusEnum);
export type PubKeyStatusSchema = z.infer<typeof PubKeyStatusSchema>;
