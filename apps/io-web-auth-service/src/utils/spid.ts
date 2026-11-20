import {
  type SpidAuthLevel,
  type SpidLevel,
} from "../domain/value-objects/login.vo.js";

export const toFullyQualifiedSpidLevel = (level: SpidAuthLevel): SpidLevel =>
  `https://www.spid.gov.it/${level}`;
