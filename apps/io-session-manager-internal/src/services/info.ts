import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { Package } from "../repositories/package";
import { ApplicationInfo } from "../generated/definitions/internal/ApplicationInfo";

export type InfoServiceDeps = {
  Package: Package;
};

const getPackageInfo: RTE.ReaderTaskEither<
  InfoServiceDeps,
  Error,
  ApplicationInfo
> = (deps) =>
  TE.of({
    name: deps.Package.getValueFromPackageJson("name"),
    version: deps.Package.getCurrentBackendVersion(),
  });

export type InfoService = typeof InfoService;
export const InfoService = {
  getPackageInfo,
};
