import { defineWorkspace } from "vitest/config";
import { config } from "dotenv";

// defineWorkspace provides a nice type hinting DX
export default defineWorkspace([
  {
    extends: "apps/io-session-manager/vite.config.mts",
    test: {
      name: "session-manager",
      include: ["apps/io-session-manager/**/__tests__/*.spec.ts"],
      environment: "node",
      env: {
        ...config({ path: "apps/io-session-manager/env.example" }).parsed,
        SAML_KEY_PATH: "apps/io-session-manager/certs/key.pem",
        SAML_CERT_PATH: "apps/io-session-manager/certs/cert.pem",
      },
    },
  },
  {
    extends: "apps/io-fast-login/vite.config.mts",
    test: {
      name: "fast-login",
      include: ["apps/io-fast-login/**/__tests__/*.spec.ts"],
      environment: "node",
    },
  }
]);
