import { GenericError } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { type PackageInfo } from "@pagopa/io-package-info";
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { getHealthCheckUseCase } from "../health-check.use-case.js";

const aPackageInfo: PackageInfo = {
  name: "application",
  version: "0.0.1",
};

const successPort = (): HealthCheckOutboundPort => ({
  healthcheck: () => Promise.resolve(ok(void 0)),
});

const failingPort = (message: string): HealthCheckOutboundPort => ({
  healthcheck: () => Promise.resolve(err(new GenericError(message))),
});

const rejectingPort = (reason: string): HealthCheckOutboundPort => ({
  healthcheck: () => Promise.reject(new Error(reason)),
});

describe("getHealthCheckUseCase", () => {
  it("should return package info when there are no ports", async () => {
    const result = await getHealthCheckUseCase(aPackageInfo, [])({});

    expect(result._unsafeUnwrap()).toEqual(aPackageInfo);
  });

  it("should return package info when all healthchecks succeed", async () => {
    const result = await getHealthCheckUseCase(aPackageInfo, [
      { name: "dep1", port: successPort() },
      { name: "dep2", port: successPort() },
    ])({});

    expect(result._unsafeUnwrap()).toEqual(aPackageInfo);
  });

  it("should report only the failing ports when some succeed", async () => {
    const result = await getHealthCheckUseCase(aPackageInfo, [
      { name: "dep1", port: successPort() },
      { name: "dep2", port: failingPort("boom") },
    ])({});

    const message = result._unsafeUnwrapErr().message;
    expect(message).toContain("[dep2]:");
    expect(message).toContain("boom");
    expect(message).not.toContain("dep1");
  });

  it("should collect all errors when every healthcheck fails", async () => {
    const result = await getHealthCheckUseCase(aPackageInfo, [
      { name: "dep1", port: failingPort("first") },
      { name: "dep2", port: rejectingPort("second") },
      { name: "dep3", port: failingPort("third") },
    ])({});

    const message = result._unsafeUnwrapErr().message;
    expect(message).toMatch(/\[dep1\]:.*first/);
    expect(message).toMatch(/\[dep2\]:.*second/);
    expect(message).toMatch(/\[dep3\]:.*third/);
  });
});
