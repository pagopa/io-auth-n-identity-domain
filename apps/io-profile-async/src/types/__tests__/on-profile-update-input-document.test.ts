import { describe, expect, it } from "vitest";
import * as E from "fp-ts/lib/Either";
import { OnProfileUpdateDocument } from "../on-profile-update-input-document";

describe("ProfileDocument", () => {
  const baseProps = {
    _self: "a string",
    fiscalCode: "VSFNVG14A39Y596X",
    version: 0
  };

  it("should return E.right when decoding baseProps with isEmailValidated equal to true", () => {
    const res = OnProfileUpdateDocument.decode({
      ...baseProps,
      isEmailValidated: true
    });
    expect(res).toEqual(
      E.right({
        ...baseProps,
        isEmailValidated: true
      })
    );
  });

  it("should return E.right with isEmailValidated set to true when decoding baseProps", () => {
    const res = OnProfileUpdateDocument.decode(baseProps);
    expect(res).toEqual(E.right({ ...baseProps, isEmailValidated: true }));
  });

  it("should return E.right when decoding baseProps with isEmailValidated equal to false", () => {
    const res = OnProfileUpdateDocument.decode({
      ...baseProps,
      isEmailValidated: false
    });
    expect(res).toEqual(
      E.right({
        ...baseProps,
        isEmailValidated: false
      })
    );
  });
});
