import { PatternString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const Sha256String = PatternString("^[a-f0-9]{64}$");
export type Sha256String = t.TypeOf<typeof Sha256String>;
