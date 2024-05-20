import { describe, test, expect } from "vitest";
import { omit } from "../types";

describe("omit", () => {
  const aValue = "value";
  const bValue = "value 2";
  const anObject = {
    a: aValue,
    b: bValue,
  };

  test("should omit a property from an object if exists", () => {
    const omittedObject = omit(["a"], anObject);
    expect(omittedObject).toHaveProperty("b", bValue);
    expect(omittedObject).not.toHaveProperty("a");
  });

  test("should rise a transpile error accessing omitted prop", () => {
    const omittedObject = omit(["a"], anObject);
    // @ts-expect-error Testing a compile error accessing omitted prop
    expect(omittedObject.a).toBeUndefined();
  });
});
