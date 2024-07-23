import { defineWorkspace } from "vitest/config";
import { config } from "dotenv";

// defineWorkspace provides a nice type hinting DX
export default defineWorkspace([
  {
    extends: "apps/session-manager/vite.config.mts",
    test: {
      name: "session-manager",
      include: ["apps/session-manager/**/__tests__/*.spec.ts"],
      environment: "node",
      env: {
        ...config({ path: "apps/session-manager/env.example" }).parsed,
        SAML_KEY_PATH: "apps/session-manager/certs/key.pem",
        SAML_CERT_PATH: "apps/session-manager/certs/cert.pem",
      },
    },
  },
]);
