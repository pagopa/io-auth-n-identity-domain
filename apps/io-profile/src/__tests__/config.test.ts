import { describe, expect, it } from "vitest";
import { getValidationEmailMailerConfig, IConfig } from "../config";

const anOverriddenMailupUsername = "anOverriddenMailupUsername";
const anOverriddenMailupSecret = "anOverriddenMailupSecret";

const baseConfig = {
  MAIL_FROM: "aMailFrom",
  MAILUP_SECRET: "aMailupSecret",
  MAILUP_USERNAME: "aMailupUsername",
  NODE_ENV: "production",
} as unknown as IConfig;

describe("getValidationEmailMailerConfig", () => {
  it("should return the original config if override values are not set", () => {
    const result = getValidationEmailMailerConfig(baseConfig);

    expect(result).toEqual(expect.objectContaining(baseConfig));
  });

  it("should return the original config if only one override value is set", () => {
    const config = {
      ...baseConfig,
      OVERRIDE_MAILUP_USERNAME_VALIDATION_EMAIL: anOverriddenMailupUsername,
    } as unknown as IConfig;

    const result = getValidationEmailMailerConfig(config);
    expect(result).toEqual(config);
  });

  it("should override MailerConfig when both override values are set", () => {
    const config = {
      MAIL_FROM: "aMailFrom",
      MAILUP_SECRET: "aMailupSecret",
      MAILUP_USERNAME: "aMailupUsername",
      NODE_ENV: "production",
      OVERRIDE_MAILUP_USERNAME_VALIDATION_EMAIL: anOverriddenMailupUsername,
      OVERRIDE_MAILUP_SECRET_VALIDATION_EMAIL: anOverriddenMailupSecret,
    };
    const result = getValidationEmailMailerConfig(config as unknown as IConfig);
    expect(result).toEqual(
      expect.objectContaining({
        MAILUP_USERNAME: anOverriddenMailupUsername,
        MAILUP_SECRET: anOverriddenMailupSecret,
      }),
    );
  });
});
