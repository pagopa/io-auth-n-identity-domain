import { describe, expect, it } from "vitest";

import { CidrListSchema, CidrSchema } from "../cidr.vo.js";

describe("CidrSchema", () => {
  it.each(["0.0.0.0/0", "10.0.0.0/8", "192.168.1.1/32", "255.255.255.255/32"])(
    "accepts %s",
    (input) => {
      expect(CidrSchema.safeParse(input).success).toBe(true);
    },
  );

  it("normalizes a bare IPv4 address to /32", () => {
    const result = CidrSchema.safeParse("192.168.1.1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("192.168.1.1/32");
    }
  });

  it.each`
    scenario         | input
    ${"octet > 255"} | ${"256.0.0.0/8"}
    ${"prefix > 32"} | ${"10.0.0.0/33"}
    ${"IPv6"}        | ${"::1/128"}
    ${"empty"}       | ${""}
  `("rejects $scenario", ({ input }) => {
    expect(CidrSchema.safeParse(input).success).toBe(false);
  });
});

describe("CidrListSchema", () => {
  it("parses a single CIDR", () => {
    const result = CidrListSchema.safeParse("10.0.0.0/8");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["10.0.0.0/8"]);
    }
  });

  it("normalizes bare IPs to /32", () => {
    const result = CidrListSchema.safeParse("192.168.1.1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["192.168.1.1/32"]);
    }
  });

  it("parses a comma-separated list and trims whitespace", () => {
    const result = CidrListSchema.safeParse(
      "10.0.0.0/8, 192.168.1.1 ,172.16.0.0/12",
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        "10.0.0.0/8",
        "192.168.1.1/32",
        "172.16.0.0/12",
      ]);
    }
  });

  it("rejects a list containing an invalid entry", () => {
    expect(CidrListSchema.safeParse("10.0.0.0/8,not-an-ip").success).toBe(
      false,
    );
  });
});
