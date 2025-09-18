import { PatternString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export type Sha256HexString = t.TypeOf<typeof Sha256HexString>;
export const Sha256HexString = PatternString("^[a-fA-F0-9]{64}$");
