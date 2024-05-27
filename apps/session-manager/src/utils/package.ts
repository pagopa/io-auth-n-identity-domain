import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { pipe } from "fp-ts/lib/function";
import * as packageJson from "../../package.json";

/**
 * Parse the string value of a specified key from the package.json file.
 * If it doesn't exists, returns 'UNKNOWN'
 */
export const getValueFromPackageJson = (
  key: keyof typeof packageJson,
): string =>
  pipe(
    t.string.decode(packageJson[key]),
    E.getOrElse(() => "UNKNOWN"),
  );

/**
 * Parse the current API version from the version field into the package.json file.
 * If it doesn't exists, returns 'UNKNOWN'
 */
export const getCurrentBackendVersion = (): string =>
  getValueFromPackageJson("version");
