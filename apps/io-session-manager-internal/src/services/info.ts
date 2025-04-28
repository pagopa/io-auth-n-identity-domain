import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { PackageUtils } from "../utils/package";
import { ApplicationInfo } from "../generated/definitions/internal/ApplicationInfo";

export type InfoServiceDeps = {
  PackageUtils: PackageUtils;
};

const getPackageInfo: RTE.ReaderTaskEither<
  InfoServiceDeps,
  Error,
  ApplicationInfo
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        Promise.resolve({
          name: deps.PackageUtils.getValueFromPackageJson("name"),
          version: deps.PackageUtils.getCurrentBackendVersion(),
        }),
      (err) =>
        new Error(`InfoService|Error while getting package info: ${err}`),
    ),
  );

export type InfoService = typeof InfoService;
export const InfoService = {
  getPackageInfo,
};
