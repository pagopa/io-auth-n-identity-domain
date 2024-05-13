import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum FeatureFlagEnum {
  ALL = "ALL",
  BETA = "BETA",
  CANARY = "CANARY",
  NONE = "NONE",
}

export const FeatureFlag = enumType<FeatureFlagEnum>(
  FeatureFlagEnum,
  "FeatureFlag",
);

export type FeatureFlag = t.TypeOf<typeof FeatureFlag>;
