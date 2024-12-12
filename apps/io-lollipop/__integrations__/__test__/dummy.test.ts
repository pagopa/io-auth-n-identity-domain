import { expect, it } from "vitest";

it("works", () => {
    expect(true).toBe(true);
    console.log("Hello, World!");
});

it("doesn't work", () => {
    expect(true).toBe(false);
    console.log("Hello, Madness!");
});