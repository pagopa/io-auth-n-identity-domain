/**
 * SPID authentication level enum and types.
 *
 * @see http://www.agid.gov.it/agenda-digitale/infrastrutture-architetture/spid/percorso-attuazione
 */

import { SPID_LEVELS } from "@pagopa/io-spid-commons/dist/config";
import * as t from "io-ts";
import { SpidLevelEnum } from "../generated/backend/SpidLevel";

type SpidLevel1 = (typeof SpidLevelEnum)["https://www.spid.gov.it/SpidL1"];
type SpidLevel2 = (typeof SpidLevelEnum)["https://www.spid.gov.it/SpidL2"];
type SpidLevel3 = (typeof SpidLevelEnum)["https://www.spid.gov.it/SpidL3"];
type SpidLevel = SpidLevel1 | SpidLevel2 | SpidLevel3;

export function isSpidL1(uri: string): uri is SpidLevel1 {
  return uri === SpidLevelEnum["https://www.spid.gov.it/SpidL1"];
}

export function isSpidL2(uri: string): uri is SpidLevel2 {
  return uri === SpidLevelEnum["https://www.spid.gov.it/SpidL2"];
}

export function isSpidL3(uri: string): uri is SpidLevel3 {
  return uri === SpidLevelEnum["https://www.spid.gov.it/SpidL3"];
}

export function isSpidL(uri: string): uri is SpidLevel {
  return isSpidL1(uri) || isSpidL2(uri) || isSpidL3(uri);
}

export const SpidLevelArray = t.readonlyArray(t.keyof(SPID_LEVELS));
export type SpidLevelArray = t.TypeOf<typeof SpidLevelArray>;

export const SAML_NAMESPACE = {
  ASSERTION: "urn:oasis:names:tc:SAML:2.0:assertion",
  PROTOCOL: "urn:oasis:names:tc:SAML:2.0:protocol",
};
