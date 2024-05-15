import fs from "fs";
import { PatternString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { log } from "../utils/logger";

export function assertUnreachable(_: never): never {
  throw new Error("Unexpected type error");
}

export const IoLoginHostUrl = PatternString("^(https?|iologin):");

export const STRINGS_RECORD = t.record(t.string, t.string);
export type STRINGS_RECORD = t.TypeOf<typeof STRINGS_RECORD>;

/**
 * Reads a file from the filesystem..
 *
 * @param path
 * @param type
 * @returns {string}
 */
export function readFile(path: string, type: string): string {
  log.info("Reading %s file from %s", type, path);
  return fs.readFileSync(path, "utf-8");
}
