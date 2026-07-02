import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { ConfigError } from "../config-error.js";
import { createEnvConfigLoader } from "../env-config-loader.js";

const TestSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  DEBUG: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

type TestConfig = z.infer<typeof TestSchema>;

// Snapshot of the original env so tests can restore it cleanly.
const ENV_SNAPSHOT: NodeJS.ProcessEnv = { ...process.env };
let originalEnv: NodeJS.ProcessEnv;

describe("createEnvConfigLoader", () => {
  beforeEach(() => {
    originalEnv = { ...ENV_SNAPSHOT };
  });

  describe("load()", () => {
    it("returns Ok with the parsed config when all required variables are present", () => {
      process.env.PORT = "3000";
      process.env.DEBUG = "false";
      process.env.NODE_ENV = "test";

      const result = createEnvConfigLoader(TestSchema).load();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toMatchObject<TestConfig>({
        PORT: 3000,
        DEBUG: false,
        NODE_ENV: "test",
      });
    });

    it("returns Err with a ConfigError when a required variable is missing", () => {
      process.env.DEBUG = "false";
      process.env.NODE_ENV = "test";

      delete process.env.PORT;

      const result = createEnvConfigLoader(TestSchema).load();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ConfigError);
      expect(result._unsafeUnwrapErr().message).toContain("PORT");
      expect(result._unsafeUnwrapErr().message).not.toContain("DEBUG");
      expect(result._unsafeUnwrapErr().message).not.toContain("NODE_ENV");
    });

    it("error message lists all failing fields when multiple variables are invalid", () => {
      process.env.DEBUG = "false";

      process.env.NODE_ENV = "INVALID";
      delete process.env.PORT;

      const result = createEnvConfigLoader(TestSchema).load();

      const message = result._unsafeUnwrapErr().message;

      expect(message).toContain("PORT");
      expect(message).toContain("NODE_ENV");
      expect(message).not.toContain("DEBUG");
    });
  });
});
