import { createPackageInfoAdapter } from "@pagopa/io-package-info";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { type Config } from "../domain/value-objects/configs/index.js";

const config: Config = {
  HOST: "127.0.0.1",
  PORT: 3000,
  NODE_ENV: "development",
};
const packageInfo = createPackageInfoAdapter(
  fileURLToPath(new URL("../../package.json", import.meta.url)),
)
  .load()
  ._unsafeUnwrap();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createApp", () => {
  it("trusts the forwarded client IP", async () => {
    const { server } = await createApp(config, packageInfo);
    server.get("/client-ip", async (request) => ({ ip: request.ip }));

    try {
      const response = await server.inject({
        method: "GET",
        url: "/client-ip",
        headers: { "x-forwarded-for": "203.0.113.1" },
      });

      expect(response.json()).toEqual({ ip: "203.0.113.1" });
    } finally {
      await server.close();
    }
  });
});
