import { describe, it, expect } from "vitest";
import { LoginTypeEnum } from "../../types/fast-login";
import { getLoginTypeOnElegible } from "../fast-login";

describe("fastLogin|>getIsUserElegibleForfastLogin", () => {
  it.each`
    loginType               | isUserElegibleForFastLogin | expectedResult
    ${undefined}            | ${false}                   | ${LoginTypeEnum.LEGACY}
    ${undefined}            | ${true}                    | ${LoginTypeEnum.LEGACY}
    ${LoginTypeEnum.LEGACY} | ${false}                   | ${LoginTypeEnum.LEGACY}
    ${LoginTypeEnum.LEGACY} | ${true}                    | ${LoginTypeEnum.LEGACY}
    ${LoginTypeEnum.LV}     | ${false}                   | ${LoginTypeEnum.LEGACY}
    ${LoginTypeEnum.LV}     | ${true}                    | ${LoginTypeEnum.LV}
  `(
    "should return $expectedResult when loginType is $loginType and user is eligible for fast-login $isUserEligibleForFastLogin",
    async ({ loginType, isUserElegibleForFastLogin, expectedResult }) => {
      const result = getLoginTypeOnElegible(
        loginType,
        isUserElegibleForFastLogin,
      );

      expect(result).toEqual(expectedResult);
    },
  );
});
