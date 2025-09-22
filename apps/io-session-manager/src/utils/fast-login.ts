import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import express from "express";
import * as t from "io-ts";
import {
  FeatureFlag,
  getIsUserEligibleForNewFeature,
} from "@pagopa/ts-commons/lib/featureFlag";
import {
  AdditionalLoginProps,
  AdditionalLoginPropsT,
  LoginTypeEnum,
} from "../types/fast-login";

export const getIsUserElegibleForfastLogin = (
  betaTesters: ReadonlyArray<FiscalCode>,
  FF_FastLogin: FeatureFlag,
) =>
  getIsUserEligibleForNewFeature<FiscalCode>(
    (fiscalCode) => betaTesters.includes(fiscalCode),
    (_fiscalCode) => false,
    FF_FastLogin,
  );

export const getLoginTypeOnElegible = (
  loginType: LoginTypeEnum | undefined,
  isUserEligibleForFastLogin: boolean,
): LoginTypeEnum =>
  loginType === LoginTypeEnum.LV && isUserEligibleForFastLogin
    ? LoginTypeEnum.LV
    : LoginTypeEnum.LEGACY;

export const acsRequestMapper = (
  req: express.Request,
): t.Validation<AdditionalLoginPropsT> =>
  AdditionalLoginProps.decode({
    loginType: req.header("x-pagopa-login-type"),
    currentUser: req.header("x-pagopa-current-user"),
  });
