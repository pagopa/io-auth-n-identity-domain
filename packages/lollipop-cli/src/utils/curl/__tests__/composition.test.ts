import {
  COMMAND_PREFIX,
  concat,
  addLocation,
  wrapWithNewLine,
  addBody,
  addHeader
} from "../composition";
import { describe, it, expect } from "vitest";

const anUrl = "https://example.com";
describe("curl composition", () => {
  it("should compose a curl command with location", () => {
    const result = concat(COMMAND_PREFIX, addLocation(anUrl));

    expect(result).toEqual(expect.stringContaining(`curl -L ${anUrl} \\`));
    expect(result.split("\n")).toHaveLength(2);
  });

  it("should compose a curl command with an header", () => {
    const result = concat(
      COMMAND_PREFIX,
      addLocation(anUrl),
      addHeader("Accept", "application/json")
    );

    expect(result).toEqual(
      expect.stringContaining(`-H 'Accept:application/json' \\`)
    );
    expect(result.split("\n")).toHaveLength(3);
  });

  it("should compose a curl command with body", () => {
    const anObject = { aKey: "aValue" };
    const result = concat(
      COMMAND_PREFIX,
      addLocation(anUrl),
      addBody(JSON.stringify(anObject))
    );

    expect(result).toEqual(
      expect.stringContaining(`-d ${JSON.stringify(anObject)} \\`)
    );
    expect(result.split("\n")).toHaveLength(3);
  });
});

describe("wrapWithNewLine", () => {
  it("wrapWithNewLine", () => {
    const result = wrapWithNewLine("a line");

    expect(result).toEqual(expect.stringContaining("\\"));
    expect(result).toEqual(expect.stringContaining("\n"));
  });
});
