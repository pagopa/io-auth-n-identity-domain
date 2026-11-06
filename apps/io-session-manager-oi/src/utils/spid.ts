import { SpidLevel } from "@pagopa/io-auth-n-identity-session";
import { SpidAuthLevel } from "../domain/value-objects/login.vo.js";

type ReserveSpidLevel = Exclude<SpidLevel, "https://www.spid.gov.it/SpidL1">;

export function toFullyQualifiedSpidLevel(
  level: SpidAuthLevel,
): ReserveSpidLevel;
export function toFullyQualifiedSpidLevel(
  level: SpidAuthLevel | "SpidL1",
): SpidLevel {
  return `https://www.spid.gov.it/${level}`;
}